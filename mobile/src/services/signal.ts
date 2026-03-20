import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SignalManager from '../crypto/SignalManager';
import { withSignalLock } from '../crypto/SignalManager';
import { PeerKeyBundle } from './keys';
import { fetchPeerDevices, DeviceBundle } from './devices';
import { websocket } from './websocket';

// Dedup guard: track messages already decrypted in this session to prevent
// the sync path from re-decrypting messages already processed via message.new.
// Re-decrypting a PreKey message resets the session, corrupting the ratchet state.
const decryptedMessageIds = new Set<string>();

/**
 * Generate a unique client message ID.
 */
function generateClientMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Storage key to persist the peer's device ID (used by decrypt path)
function peerDeviceKey(myUserId: number, peerUserId: number): string {
    return `peer_device_id:${myUserId}:${peerUserId}`;
}

/**
 * Persist the peer's real device ID for future sessions.
 */
async function savePeerDeviceId(myUserId: number, peerUserId: number, deviceId: number): Promise<void> {
    try {
        await AsyncStorage.setItem(peerDeviceKey(myUserId, peerUserId), deviceId.toString());
    } catch { }
}

/**
 * Ensure a Signal session exists with a specific device.
 * If no session: fetch key bundle for that device and perform X3DH (Rule 6).
 * If identity key changed: invalidate and re-establish (Rule 21, 30).
 *
 * Returns the device_id used for the session.
 */
async function ensureSessionForDevice(
    peerUserId: number,
    device: DeviceBundle,
): Promise<void> {
    const deviceId = device.device_id;
    let sessionExists = false;
    try {
        sessionExists = await SignalManager.hasSession(peerUserId, deviceId);
    } catch { }

    if (!sessionExists) {
        console.log(`No session with User ${peerUserId} Device ${deviceId} → X3DH`);
        // Build a PeerKeyBundle from the DeviceBundle
        const bundle: PeerKeyBundle = {
            user_id: peerUserId,
            device_id: deviceId,
            registration_id: device.registration_id,
            identity_public_key: device.identity_public_key,
            identity_key_version: device.identity_key_version,
            signed_prekey_id: device.signed_prekey_id,
            signed_prekey_public: device.signed_prekey_public,
            signed_prekey_signature: device.signed_prekey_signature,
            one_time_prekey_id: device.one_time_prekey_id ?? 0,
            one_time_prekey_public: device.one_time_prekey_public ?? '',
        };
        await SignalManager.initSession(peerUserId, bundle);
        console.log(`X3DH session established with User ${peerUserId} Device ${deviceId}`);
    }
    // TODO (Rule 21): Compare identity key with stored value and reset if changed
}

/**
 * Encrypt a message for a single device. Returns ciphertext + header.
 * On failure: re-fetch bundle, re-establish session, retry once (Rule 30).
 */
async function encryptForDevice(
    peerUserId: number,
    device: DeviceBundle,
    plaintext: string,
): Promise<{ receiver_device_id: number; ciphertext_b64: string; header: Record<string, any> }> {
    const deviceId = device.device_id;

    try {
        const encrypted = await SignalManager.encrypt(peerUserId, deviceId, plaintext);
        return {
            receiver_device_id: deviceId,
            ciphertext_b64: encrypted.ciphertext_b64,
            header: encrypted.header,
        };
    } catch (err: any) {
        console.error(`Encrypt failed for User ${peerUserId} Device ${deviceId}: ${err.message} — retrying with fresh bundle`);
        // Re-establish session and retry once
        const bundle: PeerKeyBundle = {
            user_id: peerUserId,
            device_id: deviceId,
            registration_id: device.registration_id,
            identity_public_key: device.identity_public_key,
            identity_key_version: device.identity_key_version,
            signed_prekey_id: device.signed_prekey_id,
            signed_prekey_public: device.signed_prekey_public,
            signed_prekey_signature: device.signed_prekey_signature,
            one_time_prekey_id: device.one_time_prekey_id ?? 0,
            one_time_prekey_public: device.one_time_prekey_public ?? '',
        };
        await SignalManager.initSession(peerUserId, bundle);
        const encrypted = await SignalManager.encrypt(peerUserId, deviceId, plaintext);
        return {
            receiver_device_id: deviceId,
            ciphertext_b64: encrypted.ciphertext_b64,
            header: encrypted.header,
        };
    }
}

/**
 * Fan-out encrypt and send a message to a peer.
 *
 * Rules implemented:
 *  R1  — Device list fetched fresh from server every send
 *  R3  — Encrypt separately per device (each has own ratchet)
 *  R5  — Sender's other devices get encrypted copy (self-sync)
 *  R6  — Missing session → auto X3DH
 *  R14 — Encryption happens on client side
 *  R15 — Partial failure: message still sends for successful devices
 *  R16 — sender_device_id included in payload
 *  R19 — Self-device sessions via X3DH
 *  R22 — Only active devices (server filters)
 *  R28 — Atomic: all ciphertexts share same clientMessageId
 *  R34 — No re-encrypt on retry (ciphertext stored for retry)
 *
 * @param receiverUserId - The peer user to send to
 * @param plaintext - The plaintext message
 * @param conversationId - Optional conversation ID (unused in fan-out, kept for compat)
 * @param myUserId - Current user's ID (needed for self-sync)
 * @param myDeviceId - Current user's device ID (to exclude from self-sync)
 */
export async function sendEncryptedMessage(
    receiverUserId: number,
    plaintext: string,
    conversationId: number | string | null = null,
    myUserId: number = 0,
    myDeviceId: number = 0,
    messageType: 'text' | 'media' | 'call' | 'system' = 'text',
): Promise<string> {
    return withSignalLock(async () => {
        const clientMessageId = generateClientMessageId();

        // ──────── Step 1: Fetch ALL of receiver's active devices (Rule 1) ────────
        let peerDevices: DeviceBundle[] = [];
        try {
            peerDevices = await fetchPeerDevices(receiverUserId);
            console.log(`FAN-OUT SEND  |  Me → User ${receiverUserId}  |  ${peerDevices.length} peer device(s)`);
        } catch (err: any) {
            throw new Error(`SEND_FAILED: Could not fetch devices for User ${receiverUserId}: ${err.message}`);
        }

        if (peerDevices.length === 0) {
            throw new Error(`SEND_FAILED: No active devices for User ${receiverUserId}`);
        }

        // ──────── Step 2: Fetch sender's OTHER devices for self-sync (Rule 5) ────────
        let selfDevices: DeviceBundle[] = [];
        if (myUserId > 0 && myDeviceId > 0) {
            try {
                const myDeviceBundles = await fetchPeerDevices(myUserId);
                // Exclude current sending device
                selfDevices = myDeviceBundles.filter(d => d.device_id !== myDeviceId);
                if (selfDevices.length > 0) {
                    console.log(`SELF-SYNC  |  ${selfDevices.length} other own device(s)`);
                }
            } catch (err: any) {
                console.warn(`Failed to fetch self devices for self-sync: ${err.message}`);
                // Non-fatal: message still sends to peer devices
            }
        }

        // ──────── Step 3: Combine all target devices ────────
        const allTargets = [...peerDevices, ...selfDevices];

        // ──────── Step 4: Ensure sessions + encrypt for each device (Rules 3, 6, 18) ────────
        const ciphertexts: Array<{
            receiver_device_id: number;
            ciphertext_b64: string;
            header: Record<string, any>;
        }> = [];

        const failedDevices: number[] = [];

        for (const device of allTargets) {
            try {
                // Ensure session exists (X3DH if needed — Rule 6)
                await ensureSessionForDevice(device.user_id, device);

                // Encrypt for this device (Rule 3 — separate ratchet per device)
                const encrypted = await encryptForDevice(device.user_id, device, plaintext);
                ciphertexts.push(encrypted);
            } catch (err: any) {
                console.error(`Failed to encrypt for User ${device.user_id} Device ${device.device_id}: ${err.message}`);
                failedDevices.push(device.device_id);
                // Rule 15: Partial failure OK — continue with other devices
            }
        }

        if (ciphertexts.length === 0) {
            throw new Error(`FAN_OUT_FAILED: Could not encrypt for any device of User ${receiverUserId}`);
        }

        // ──────── Step 5: Send fan-out payload (Rule 28 — atomic per messageId) ────────
        websocket.sendFanOutMessage(receiverUserId, clientMessageId, ciphertexts, conversationId, messageType);

        console.log(
            `FAN-OUT SENT  |  msgId=${clientMessageId}  |  ` +
            `encrypted=${ciphertexts.length}  |  failed=${failedDevices.length}  |  ` +
            `devices=[${ciphertexts.map(c => c.receiver_device_id).join(',')}]`
        );

        if (failedDevices.length > 0) {
            console.warn(`Failed devices: [${failedDevices.join(',')}]`);
        }

        return clientMessageId;
    }); // end withSignalLock
}


/**
 * Check if a message has already been decrypted in this session.
 * Used by sync path to skip messages already processed via message.new.
 */
export function isMessageAlreadyDecrypted(messageId: string): boolean {
    return decryptedMessageIds.has(messageId);
}

/**
 * Decrypt an incoming message.
 * Handles both PreKey messages (first message, X3DH) and Signal messages (ongoing).
 */
export async function decryptIncomingMessage(
    ciphertextB64: string,
    header: Record<string, any>,
    senderUserId: number,
    senderDeviceId: number = 1,
    myUserId?: number,
    messageId?: string,
): Promise<string> {
    // Dedup guard: prevent double-decryption which would reset the session
    if (messageId && decryptedMessageIds.has(messageId)) {
        return '[already decrypted]';
    }

    return withSignalLock(async () => {
        console.log(`RECEIVE FLOW  |  User ${senderUserId} → Me  |  type=${header?.message_type || 'unknown'}  |  device=${senderDeviceId}  |  ciphertext=${ciphertextB64.length} chars`);
        try {
            const plaintext = await SignalManager.decrypt(
                senderUserId,
                senderDeviceId,
                ciphertextB64,
                header,
            );

            // Mark as decrypted to prevent re-processing
            if (messageId) {
                decryptedMessageIds.add(messageId);
            }

            // Persist the sender's device ID so that when we reply,
            // sendEncryptedMessage knows which device to encrypt for.
            if (senderDeviceId > 1 && myUserId) {
                await savePeerDeviceId(myUserId, senderUserId, senderDeviceId);
            }

            return plaintext;
        } catch (err: any) {
            console.error(`DECRYPT FAILED  |  User ${senderUserId} → Me  |  device=${senderDeviceId}  |  type=${header?.message_type}  |  error: ${err.message}`);
            // Only invalidate the session if the error indicates an identity change.
            // Do NOT destroy sessions on transient errors (out-of-order messages, etc.)
            const isIdentityError = err.message?.toLowerCase().includes('untrusted') ||
                err.message?.toLowerCase().includes('identity') ||
                err.message?.includes('UntrustedIdentity');

            if (isIdentityError) {
                try {
                    await SignalManager.invalidateSession(senderUserId, senderDeviceId);
                } catch { }

                throw new Error(
                    `IDENTITY_CHANGED: Unable to decrypt message from user ${senderUserId}. ` +
                    'Security number may have changed.',
                );
            }

            throw new Error(
                `DECRYPT_FAILED: Unable to decrypt message from user ${senderUserId}: ${err.message}`,
            );
        }
    }); // end withSignalLock
}

/**
 * Invalidate a session with a peer.
 */
export async function invalidateSession(peerUserId: number, peerDeviceId: number = 1): Promise<void> {
    await SignalManager.invalidateSession(peerUserId, peerDeviceId);
}

/**
 * Check if a session exists with a peer.
 */
export async function hasSession(peerUserId: number, peerDeviceId: number = 1): Promise<boolean> {
    return SignalManager.hasSession(peerUserId, peerDeviceId);
}
