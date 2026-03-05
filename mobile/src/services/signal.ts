import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SignalManager from '../crypto/SignalManager';
import { fetchPeerKeyBundle, PeerKeyBundle } from './keys';
import { websocket } from './websocket';

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
 */
export async function sendEncryptedMessage(
    receiverUserId: number,
    plaintext: string,
    conversationId: number | null = null,
    myUserId: number = 0,
    preferredDeviceId: number | null = null,
): Promise<string> {
    // Determine device ID: prefer what we know from last message, then stored, then default
    let peerDeviceId = preferredDeviceId ?? await loadPeerDeviceId(myUserId, receiverUserId);

    // Check if a session exists with this device ID
    let sessionExists = false;
    try {
        sessionExists = await SignalManager.hasSession(receiverUserId, peerDeviceId);
    } catch (err: any) {
        console.warn('[Signal] hasSession check failed, will create new session:', err.message);
    }

    if (!sessionExists) {
        // No session — perform X3DH key agreement
        const peerBundle: PeerKeyBundle = await fetchPeerKeyBundle(receiverUserId);
        peerDeviceId = peerBundle.device_id;
        await SignalManager.initSession(receiverUserId, peerBundle);
        // Persist the real device ID for future calls
        if (myUserId) await savePeerDeviceId(myUserId, receiverUserId, peerDeviceId);
    }

    // Try to encrypt; on any failure re-create session with a fresh bundle and retry once
    let encrypted;
    try {
        encrypted = await SignalManager.encrypt(receiverUserId, peerDeviceId, plaintext);
    } catch (err: any) {
        console.warn('[Signal] Encrypt failed, re-establishing session:', err.message);
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

    return clientMessageId;
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
): Promise<string> {
    try {
        const plaintext = await SignalManager.decrypt(
            senderUserId,
            senderDeviceId,
            ciphertextB64,
            header,
        );
        return plaintext;
    } catch (err: any) {
        console.error('[Signal] Decryption failed:', err.message);

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
