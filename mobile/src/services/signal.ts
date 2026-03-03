import * as SignalManager from '../crypto/SignalManager';
import { fetchPeerKeyBundle, PeerKeyBundle } from './keys';
import { websocket } from './websocket';

/**
 * Generate a unique client message ID.
 */
function generateClientMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Encrypt and send a message to a peer.
 * Handles session creation (X3DH) automatically if needed.
 */
export async function sendEncryptedMessage(
    receiverUserId: number,
    plaintext: string,
    conversationId: number | null = null,
): Promise<string> {
    // Default device ID — server returns the latest device's ID in the key bundle
    let peerDeviceId = 1;

    // Check if session exists
    const exists = await SignalManager.hasSession(receiverUserId, peerDeviceId);

    if (!exists) {
        // No session — perform X3DH key agreement
        const peerBundle: PeerKeyBundle = await fetchPeerKeyBundle(receiverUserId);
        peerDeviceId = peerBundle.device_id;
        await SignalManager.initSession(receiverUserId, peerBundle);
    }

    // Encrypt using Double Ratchet
    const { ciphertext_b64, header } = await SignalManager.encrypt(
        receiverUserId,
        peerDeviceId,
        plaintext,
    );

    const clientMessageId = generateClientMessageId();

    // Send via WebSocket
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
        // If decryption fails, the session may be corrupted (e.g., sender reinstalled app)
        console.error('[Signal] Decryption failed:', err.message);

        // Try to invalidate the corrupted session
        try {
            await SignalManager.invalidateSession(senderUserId, senderDeviceId);
        } catch { }

        throw new Error(
            `IDENTITY_CHANGED: Unable to decrypt message from user ${senderUserId}. ` +
            'Security number may have changed.',
        );
    }
}

/**
 * Invalidate a session with a peer.
 * Used when identity key change is detected.
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
