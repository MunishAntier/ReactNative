import { NativeModules } from 'react-native';
import { fetchPeerKeyBundle, PeerKeyBundle } from './keys';
import { websocket } from './websocket';

const { SignalBridge } = NativeModules;

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
    // Check if session exists
    const hasSession = await SignalBridge.hasSession(receiverUserId);

    if (!hasSession) {
        // No session — perform X3DH key agreement
        const peerBundle: PeerKeyBundle = await fetchPeerKeyBundle(receiverUserId);
        await SignalBridge.initializeSession(receiverUserId, peerBundle);
    }

    // Encrypt using Double Ratchet
    const { ciphertext_b64, header } = await SignalBridge.encrypt(
        plaintext,
        receiverUserId,
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
): Promise<string> {
    try {
        const plaintext: string = await SignalBridge.decrypt(
            ciphertextB64,
            header,
            senderUserId,
        );
        return plaintext;
    } catch (err: any) {
        // If decryption fails, the session may be corrupted (e.g., sender reinstalled app)
        // Invalidate session and notify the UI
        console.error('[Signal] Decryption failed:', err.message);

        // Try to invalidate the corrupted session
        try {
            await SignalBridge.invalidateSession(senderUserId);
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
export async function invalidateSession(peerUserId: number): Promise<void> {
    await SignalBridge.invalidateSession(peerUserId);
}

/**
 * Check if a session exists with a peer.
 */
export async function hasSession(peerUserId: number): Promise<boolean> {
    return SignalBridge.hasSession(peerUserId);
}
