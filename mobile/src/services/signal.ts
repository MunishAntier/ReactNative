import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SignalManager from '../crypto/SignalManager';
import { withSignalLock } from '../crypto/SignalManager';
import { fetchPeerKeyBundle, PeerKeyBundle } from './keys';
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

// Storage key to persist the peer's real device ID
function peerDeviceKey(myUserId: number, peerUserId: number): string {
    return `peer_device_id:${myUserId}:${peerUserId}`;
}

/**
 * Load the last known device ID for a peer (persisted across sessions).
 */
async function loadPeerDeviceId(myUserId: number, peerUserId: number): Promise<number> {
    try {
        const val = await AsyncStorage.getItem(peerDeviceKey(myUserId, peerUserId));
        return val ? parseInt(val, 10) : 1;
    } catch { return 1; }
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
 * Encrypt and send a message to a peer.
 * Handles session creation (X3DH) automatically if needed.
 *
 * Returns { clientMessageId, resolvedDeviceId } so callers can track the
 * real device ID for this peer.
 */
export async function sendEncryptedMessage(
    receiverUserId: number,
    plaintext: string,
    conversationId: number | null = null,
    myUserId: number = 0,
    preferredDeviceId: number | null = null,
): Promise<string> {
    return withSignalLock(async () => {
        // Resolve device ID: use stored value first, then preferred, then default (1).
        // preferredDeviceId=1 is the caller's default and unreliable, so we check
        // the persisted value first (which holds the REAL device ID from the last
        // successful session establishment).
        const storedDeviceId = await loadPeerDeviceId(myUserId, receiverUserId);
        let peerDeviceId: number;

        if (storedDeviceId > 1) {
            // We have a known real device ID from a previous session
            peerDeviceId = storedDeviceId;
        } else if (preferredDeviceId && preferredDeviceId > 1) {
            // Caller provided a non-default device ID (e.g. from a received message)
            peerDeviceId = preferredDeviceId;
        } else {
            // No known device ID — will be resolved from key bundle below
            peerDeviceId = 1;
        }

        // Check if a session exists with this device ID
        let sessionExists = false;
        try {
            sessionExists = await SignalManager.hasSession(receiverUserId, peerDeviceId);
        } catch (_err: any) {
            // will create new session
        }

        if (!sessionExists) {
            console.log(`[Signal🔐] 📤 SEND FLOW  |  Me → User ${receiverUserId}  |  No session → creating via X3DH`);
            // No session — perform X3DH key agreement
            const peerBundle: PeerKeyBundle = await fetchPeerKeyBundle(receiverUserId);
            peerDeviceId = peerBundle.device_id;
            await SignalManager.initSession(receiverUserId, peerBundle);
            // Persist the real device ID for future calls
            if (myUserId) await savePeerDeviceId(myUserId, receiverUserId, peerDeviceId);
        } else {
            console.log(`[Signal🔐] 📤 SEND FLOW  |  Me → User ${receiverUserId}  |  Session EXISTS → Double Ratchet`);
        }

        // Try to encrypt; on any failure re-create session with a fresh bundle and retry once
        let encrypted;
        try {
            encrypted = await SignalManager.encrypt(receiverUserId, peerDeviceId, plaintext);
        } catch (_err: any) {
            console.error(`[Signal🔐] ⚠️ ENCRYPT FAILED (first attempt)  |  Me → User ${receiverUserId}  |  device=${peerDeviceId}  |  error: ${_err.message}`);
            // Re-fetch key bundle and re-create session
            const peerBundle: PeerKeyBundle = await fetchPeerKeyBundle(receiverUserId);
            peerDeviceId = peerBundle.device_id;
            if (myUserId) await savePeerDeviceId(myUserId, receiverUserId, peerDeviceId);
            await SignalManager.initSession(receiverUserId, peerBundle);
            encrypted = await SignalManager.encrypt(receiverUserId, peerDeviceId, plaintext);
        }

        const { ciphertext_b64, header } = encrypted;
        const clientMessageId = generateClientMessageId();

        websocket.sendMessage(
            conversationId,
            receiverUserId,
            clientMessageId,
            ciphertext_b64,
            header,
        );

        console.log(`[Signal🔐] 📤 SENT  |  msgId=${clientMessageId}  |  type=${header.message_type}  |  ciphertext=${ciphertext_b64.length} chars`);

        return clientMessageId;
    }); // end withSignalLock
}

/**
 * Decrypt an incoming message.
 * Handles both PreKey messages (first message, X3DH) and Signal messages (ongoing).
 */
/**
 * Check if a message has already been decrypted in this session.
 * Used by sync path to skip messages already processed via message.new.
 */
export function isMessageAlreadyDecrypted(messageId: string): boolean {
    return decryptedMessageIds.has(messageId);
}

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
        console.log(`[Signal🔐] 📥 RECEIVE FLOW  |  User ${senderUserId} → Me  |  type=${header?.message_type || 'unknown'}  |  device=${senderDeviceId}  |  ciphertext=${ciphertextB64.length} chars`);
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
            console.error(`[Signal🔐] ❌ DECRYPT FAILED  |  User ${senderUserId} → Me  |  device=${senderDeviceId}  |  type=${header?.message_type}  |  error: ${err.message}`);
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
