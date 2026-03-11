/**
 * SignalManager — High-level wrapper for all Signal Protocol operations.
 *
 * Provides:
 *   - initialize()              Load or generate identity keys
 *   - generateInitialBundle()   Create keys for first login upload
 *   - generateOneTimePreKeys()  Replenish one-time pre-keys
 *   - rotateSignedPreKey()      Rotate signed pre-key
 *   - initSession()             X3DH session setup from peer's key bundle
 *   - encrypt()                 Double Ratchet encrypt
 *   - decrypt()                 Double Ratchet decrypt
 *   - hasSession()              Check if session exists
 *   - invalidateSession()       Delete session with a peer
 */

import {
    PrivateKey,
    PublicKey,
    IdentityKeyPair,
    PreKeyRecord,
    SignedPreKeyRecord,
    ProtocolAddress,
    createAndProcessPreKeyBundle,
    signalEncrypt,
    signalDecrypt,
    signalDecryptPreKey,
    PreKeySignalMessage,
    SignalMessage,
    CiphertextMessageType,
} from 'react-native-libsignal-client';

import {
    AppIdentityKeyStore,
    AppSessionStore,
    AppPreKeyStore,
    AppSignedPreKeyStore,
    AppKyberPreKeyStore,
    initializeIdentity,
    getNextPreKeyId,
    getCurrentSignedPreKeyId,
    setCurrentSignedPreKeyId,
    clearSignalStorage,
    migrateOldKeys,
} from './SignalKeyStore';

// ────────────────────── Helper: truncated base64 for logs ──────────────────────
function b64Short(b64: string, len = 16): string {
    return b64.length > len ? b64.substring(0, len) + '…' : b64;
}
const LINE = '═══════════════════════════════════════════════════════════';

// ────────────────────────── Singleton Stores ──────────────────────────

let identityStore: AppIdentityKeyStore;
let sessionStore: AppSessionStore;
let preKeyStore: AppPreKeyStore;
let signedPreKeyStore: AppSignedPreKeyStore;
let kyberPreKeyStore: AppKyberPreKeyStore;

// Cached identity after initialization
let cachedIdentity: { userId: number; identityKeyPair: IdentityKeyPair; registrationId: number } | null = null;

// ────────────────────────── Signal Operation Mutex ──────────────────────────
// Serializes encrypt/decrypt/session operations to prevent concurrent calls
// from loading the same session, modifying it independently, and overwriting
// each other's changes. Without this, the Double Ratchet state gets corrupted.
let signalMutexChain: Promise<any> = Promise.resolve();

export async function withSignalLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const prev = signalMutexChain;
    signalMutexChain = gate;
    await prev; // wait for all prior operations to finish
    try {
        return await fn();
    } finally {
        release!();
    }
}

// ────────────────────────── Public API ──────────────────────────

/**
 * Load or generate the local identity key pair + registration ID for a specific user.
 * Must be called before any other operation.
 */
export async function initialize(userId: number): Promise<boolean> {
    if (cachedIdentity?.userId === userId) return false;

    // Migrate any keys stored under the old global prefix
    await migrateOldKeys(userId);

    identityStore = new AppIdentityKeyStore(userId);
    sessionStore = new AppSessionStore(userId);
    preKeyStore = new AppPreKeyStore(userId);
    signedPreKeyStore = new AppSignedPreKeyStore(userId);
    kyberPreKeyStore = new AppKyberPreKeyStore();

    const identity = await initializeIdentity(userId);
    cachedIdentity = { userId, identityKeyPair: identity.identityKeyPair, registrationId: identity.registrationId };
    return identity.isNew;
}

/**
 * Generate the initial key bundle for upload to server on first login.
 */
export async function generateInitialBundle(userId: number, preKeyCount: number = 100): Promise<{
    registration_id: number;
    identity_public_key: string;
    identity_key_version: number;
    signed_prekey_id: number;
    signed_prekey_public: string;
    signed_prekey_signature: string;
    signed_prekey_expires_at: string;
    one_time_prekeys: Array<{ prekey_id: number; prekey_public: string }>;
}> {
    await initialize(userId);
    const { identityKeyPair, registrationId } = cachedIdentity!;

    // Generate signed pre-key
    const signedPreKeyId = 1;
    const signedPreKeyPair = PrivateKey.generate();
    const signedPreKeyPub = signedPreKeyPair.getPublicKey();
    const signature = identityKeyPair.privateKey.sign(signedPreKeyPub.serialized);
    const timestamp = Date.now();

    const signedPreKeyRecord = SignedPreKeyRecord.new(
        signedPreKeyId,
        timestamp,
        signedPreKeyPub,
        signedPreKeyPair,
        signature,
    );
    await signedPreKeyStore.saveSignedPreKey(signedPreKeyId, signedPreKeyRecord);
    await setCurrentSignedPreKeyId(userId, signedPreKeyId);

    // Generate one-time pre-keys
    const oneTimePreKeys: Array<{ prekey_id: number; prekey_public: string }> = [];
    for (let i = 0; i < preKeyCount; i++) {
        const preKeyId = await getNextPreKeyId(userId);
        const preKeyPrivate = PrivateKey.generate();
        const preKeyPublic = preKeyPrivate.getPublicKey();
        const preKeyRecord = PreKeyRecord.new(preKeyId, preKeyPublic, preKeyPrivate);
        await preKeyStore.savePreKey(preKeyId, preKeyRecord);

        oneTimePreKeys.push({
            prekey_id: preKeyId,
            prekey_public: Buffer.from(preKeyPublic.serialized).toString('base64'),
        });
    }

    // 30-day expiry for signed pre-key
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
        registration_id: registrationId,
        identity_public_key: Buffer.from(identityKeyPair.publicKey.serialized).toString('base64'),
        identity_key_version: 1,
        signed_prekey_id: signedPreKeyId,
        signed_prekey_public: Buffer.from(signedPreKeyPub.serialized).toString('base64'),
        signed_prekey_signature: Buffer.from(signature).toString('base64'),
        signed_prekey_expires_at: expiresAt,
        one_time_prekeys: oneTimePreKeys,
    };
}

/**
 * Generate additional one-time pre-keys for replenishment.
 */
export async function generateOneTimePreKeys(
    userId: number,
    count: number = 100,
): Promise<Array<{ prekey_id: number; prekey_public: string }>> {
    await initialize(userId);
    const preKeys: Array<{ prekey_id: number; prekey_public: string }> = [];
    for (let i = 0; i < count; i++) {
        const preKeyId = await getNextPreKeyId(userId);
        const preKeyPrivate = PrivateKey.generate();
        const preKeyPublic = preKeyPrivate.getPublicKey();
        const preKeyRecord = PreKeyRecord.new(preKeyId, preKeyPublic, preKeyPrivate);
        await preKeyStore.savePreKey(preKeyId, preKeyRecord);

        preKeys.push({
            prekey_id: preKeyId,
            prekey_public: Buffer.from(preKeyPublic.serialized).toString('base64'),
        });
    }
    return preKeys;
}

/**
 * Rotate the signed pre-key. Returns the new public data for server upload.
 */
export async function rotateSignedPreKey(userId: number): Promise<{
    signed_prekey_id: number;
    signed_prekey_public: string;
    signed_prekey_signature: string;
}> {
    await initialize(userId);
    const { identityKeyPair } = cachedIdentity!;

    const currentId = await getCurrentSignedPreKeyId(userId);
    const newId = currentId + 1;

    const newPrivate = PrivateKey.generate();
    const newPublic = newPrivate.getPublicKey();
    const signature = identityKeyPair.privateKey.sign(newPublic.serialized);
    const timestamp = Date.now();

    const record = SignedPreKeyRecord.new(newId, timestamp, newPublic, newPrivate, signature);
    await signedPreKeyStore.saveSignedPreKey(newId, record);
    await setCurrentSignedPreKeyId(userId, newId);

    return {
        signed_prekey_id: newId,
        signed_prekey_public: Buffer.from(newPublic.serialized).toString('base64'),
        signed_prekey_signature: Buffer.from(signature).toString('base64'),
    };
}

/**
 * Initialize a session with a peer using their key bundle (X3DH).
 */
export async function initSession(
    peerUserId: number,
    peerBundle: {
        device_id: number;
        registration_id: number;
        identity_public_key: string;
        signed_prekey_id: number;
        signed_prekey_public: string;
        signed_prekey_signature: string;
        one_time_prekey_id: number;
        one_time_prekey_public: string;
    },
): Promise<void> {
    const address = new ProtocolAddress(peerUserId.toString(), peerBundle.device_id);

    const identityKey = PublicKey._fromSerialized(
        new Uint8Array(Buffer.from(peerBundle.identity_public_key, 'base64')),
    );
    const signedPreKey = PublicKey._fromSerialized(
        new Uint8Array(Buffer.from(peerBundle.signed_prekey_public, 'base64')),
    );
    const signedPreKeySig = new Uint8Array(
        Buffer.from(peerBundle.signed_prekey_signature, 'base64'),
    );

    const preKeyId: number = peerBundle.one_time_prekey_id;
    let preKey: PublicKey | null = null;
    if (peerBundle.one_time_prekey_public) {
        preKey = PublicKey._fromSerialized(
            new Uint8Array(Buffer.from(peerBundle.one_time_prekey_public, 'base64')),
        );
    }

    // When no one-time pre-key is available, pass a dummy public key.
    // The Signal protocol still works without one-time pre-keys (reduced security).
    const effectivePreKey = preKey ?? signedPreKey; // fallback to signed pre-key as placeholder
    const effectivePreKeyId = preKey ? preKeyId : -1;

    // ─── Log X3DH Key Agreement ───
    const ownIdPub = Buffer.from(cachedIdentity!.identityKeyPair.publicKey.serialized).toString('base64');
    console.log(`\n${LINE}`);
    console.log(`[Signal🔐] X3DH SESSION SETUP  |  Me → User ${peerUserId}  |  Device ${peerBundle.device_id}`);
    console.log(LINE);
    console.log(`  Our Identity Key (pub)   : ${b64Short(ownIdPub)}  (${cachedIdentity!.identityKeyPair.publicKey.serialized.length} bytes)`);
    console.log(`  Peer Identity Key (pub)  : ${b64Short(peerBundle.identity_public_key)}  (from bundle)`);
    console.log(`  Peer Signed PreKey (pub) : ${b64Short(peerBundle.signed_prekey_public)}  (ID=${peerBundle.signed_prekey_id})`);
    console.log(`  Peer OneTime PreKey (pub): ${preKey ? b64Short(peerBundle.one_time_prekey_public) + '  (ID=' + preKeyId + ')' : '⚠ NONE — reduced forward secrecy'}`);
    console.log(`  Peer Registration ID     : ${peerBundle.registration_id}`);
    console.log(`  Signature                : ${b64Short(peerBundle.signed_prekey_signature)}`);
    console.log(LINE);

    await createAndProcessPreKeyBundle(
        peerBundle.registration_id,
        address,
        effectivePreKeyId,
        effectivePreKey,
        peerBundle.signed_prekey_id,
        signedPreKey,
        signedPreKeySig,
        identityKey,
        sessionStore,
        identityStore,
        null, // No Kyber pre-keys
    );

    console.log(`[Signal🔐] ✅ X3DH session established with User ${peerUserId}`);
    console.log(LINE + '\n');
}

/**
 * Encrypt a plaintext message for a peer.
 * Session must exist (call initSession first if needed).
 */
export async function encrypt(
    peerUserId: number,
    peerDeviceId: number,
    plaintext: string,
): Promise<{
    ciphertext_b64: string;
    header: {
        session_version: number;
        message_type: 'prekey' | 'whisper';
        sender_identity_pub_b64: string;
        sender_ephemeral_pub_b64: string;
        receiver_one_time_prekey_id: number;
        ratchet_pub_b64: string;
        message_index: number;
    };
}> {
    if (!cachedIdentity) throw new Error('SignalManager not initialized');

    // Robustness: ensure Buffer is available
    if (typeof Buffer === 'undefined' || typeof Buffer.from !== 'function') {
        throw new Error('Buffer polyfill not found or broken');
    }

    const address = new ProtocolAddress(peerUserId.toString(), peerDeviceId);
    const message = new Uint8Array(Buffer.from(plaintext, 'utf-8'));

    // Check session exists before calling libsignal
    const session = await sessionStore.getSession(address);
    if (!session) {
        throw new Error(`No session with user ${peerUserId}. Cannot encrypt.`);
    }

    // Let libsignal handle the identity key check internally.
    const ownPrivateKey = await identityStore.getIdentityKey();
    if (!ownPrivateKey) throw new Error('Local identity private key missing');

    // Call signalEncrypt
    const cipherText = await signalEncrypt(message, address, sessionStore, identityStore);
    if (!cipherText) throw new Error('signalEncrypt returned null');

    const ciphertextBytes = cipherText.serialized;
    const msgType = cipherText.type();

    let receiverPreKeyId = 0;
    let messageIndex = 0;

    const ciphertextB64 = Buffer.from(ciphertextBytes).toString('base64');
    const senderIdPub = Buffer.from(
        cachedIdentity!.identityKeyPair.publicKey.serialized,
    ).toString('base64');

    const isPreKey = msgType === CiphertextMessageType.PreKey;
    const protocol = isPreKey ? 'X3DH + PreKey' : 'Double Ratchet + Whisper';

    // ─── Log Encryption Details ───
    console.log(`\n${LINE}`);
    console.log(`[Signal🔐] ENCRYPT  |  Me → User ${peerUserId}  |  Protocol: ${protocol}`);
    console.log(LINE);
    console.log(`  Sender Identity Key (pub): ${b64Short(senderIdPub)}  (${cachedIdentity!.identityKeyPair.publicKey.serialized.length} bytes)`);

    if (isPreKey) {
        try {
            const preKeyMsg = PreKeySignalMessage._fromSerialized(ciphertextBytes);
            receiverPreKeyId = preKeyMsg.preKeyId() ?? 0;
            const signedPKId = preKeyMsg.signedPreKeyId();
            const regId = preKeyMsg.registrationId();
            const ver = preKeyMsg.version();
            console.log(`  Receiver OneTime PreKey ID: ${receiverPreKeyId || 'none'}`);
            console.log(`  Receiver Signed PreKey ID : ${signedPKId}`);
            console.log(`  Registration ID            : ${regId}`);
            console.log(`  Protocol Version           : ${ver}`);
        } catch (_logErr: any) {
            // non-fatal
        }
    } else {
        try {
            const whisperMsg = SignalMessage._fromSerialized(ciphertextBytes);
            messageIndex = whisperMsg.counter();
            const ver = whisperMsg.messageVersion();
            console.log(`  Ratchet Counter (chain idx): ${messageIndex}`);
            console.log(`  Protocol Version           : ${ver}`);
        } catch (_logErr: any) {
            // non-fatal
        }
    }

    console.log(`  Plaintext                  : "${plaintext.substring(0, 50)}${plaintext.length > 50 ? '…' : ''}" (${plaintext.length} bytes)`);
    console.log(`  Ciphertext (b64)           : ${b64Short(ciphertextB64, 40)}  (${ciphertextBytes.length} bytes)`);
    console.log(LINE + '\n');

    return {
        ciphertext_b64: ciphertextB64,
        header: {
            session_version: 3,
            message_type: isPreKey ? 'prekey' as const : 'whisper' as const,
            sender_identity_pub_b64: senderIdPub,
            sender_ephemeral_pub_b64: '',
            receiver_one_time_prekey_id: receiverPreKeyId,
            ratchet_pub_b64: '',
            message_index: messageIndex,
        },
    };
}

/**
 * Decrypt an incoming message from a peer.
 * Handles both PreKeySignalMessage (first message) and SignalMessage (ongoing).
 */
export async function decrypt(
    senderUserId: number,
    senderDeviceId: number,
    ciphertextB64: string,
    _header: Record<string, any>,
): Promise<string> {
    if (!cachedIdentity) throw new Error('SignalManager not initialized — call initialize(userId) first');

    const address = new ProtocolAddress(senderUserId.toString(), senderDeviceId);
    const ciphertextBytes = new Uint8Array(Buffer.from(ciphertextB64, 'base64'));

    let plaintext: Uint8Array;

    // Use header's message_type if available for deterministic dispatch
    const messageType = _header?.message_type;

    if (messageType === 'prekey') {
        // ═══ RECEIVER: First message via X3DH ═══
        const preKeyMsg = PreKeySignalMessage._fromSerialized(ciphertextBytes);

        // ─── Log PreKey Decrypt Details ───
        const pkId = preKeyMsg.preKeyId();
        const spkId = preKeyMsg.signedPreKeyId();
        const regId = preKeyMsg.registrationId();
        const ver = preKeyMsg.version();
        console.log(`\n${LINE}`);
        console.log(`[Signal🔐] DECRYPT  |  User ${senderUserId} → Me  |  Protocol: X3DH + PreKey`);
        console.log(LINE);
        console.log(`  Sender Identity Key (hdr) : ${_header?.sender_identity_pub_b64 ? b64Short(_header.sender_identity_pub_b64) : 'not in header'}`);
        console.log(`  OneTime PreKey ID consumed: ${pkId ?? 'none'}`);
        console.log(`  Signed PreKey ID          : ${spkId}`);
        console.log(`  Registration ID           : ${regId}`);
        console.log(`  Protocol Version          : ${ver}`);
        console.log(`  Ciphertext received (b64) : ${b64Short(ciphertextB64, 40)}  (${ciphertextBytes.length} bytes)`);

        // Actual decryption
        plaintext = await signalDecryptPreKey(
            preKeyMsg,
            address,
            sessionStore,
            identityStore,
            preKeyStore,
            signedPreKeyStore,
            kyberPreKeyStore,
            [],
        );

        const decryptedText = Buffer.from(plaintext).toString('utf-8');
        console.log(`  Decrypted plaintext       : "${decryptedText.substring(0, 50)}${decryptedText.length > 50 ? '…' : ''}" (${decryptedText.length} bytes)`);
        console.log(`[Signal🔐] ✅ PreKey decrypt successful — session established with User ${senderUserId}`);
        console.log(LINE + '\n');

        // Explicitly save the sender's identity key after successful PreKey decryption.
        if (_header?.sender_identity_pub_b64) {
            try {
                const senderIdKeyBytes = new Uint8Array(Buffer.from(_header.sender_identity_pub_b64, 'base64'));
                const senderIdKey = PublicKey._fromSerialized(senderIdKeyBytes);
                await identityStore.saveIdentity(address, senderIdKey);
            } catch (_saveErr: any) {
                // non-fatal
            }
        }

    } else if (messageType === 'whisper') {
        // ═══ RECEIVER: Double Ratchet Whisper message ═══
        const signalMsg = SignalMessage._fromSerialized(ciphertextBytes);

        // ─── Log Whisper Decrypt Details ───
        // Note: counter() and messageVersion() call native methods that may
        // not be implemented in the iOS bridge, so wrap in try/catch.
        let counter: number | string = '?';
        let ver: number | string = '?';
        try { counter = signalMsg.counter(); } catch { /* not implemented in native module */ }
        try { ver = signalMsg.messageVersion(); } catch { /* not implemented in native module */ }
        console.log(`\n${LINE}`);
        console.log(`[Signal🔐] DECRYPT  |  User ${senderUserId} → Me  |  Protocol: Double Ratchet + Whisper`);
        console.log(LINE);
        console.log(`  Sender Identity Key (hdr) : ${_header?.sender_identity_pub_b64 ? b64Short(_header.sender_identity_pub_b64) : 'not in header'}`);
        console.log(`  Ratchet Counter (chain idx): ${counter}`);
        console.log(`  Protocol Version           : ${ver}`);
        console.log(`  Ciphertext received (b64)  : ${b64Short(ciphertextB64, 40)}  (${ciphertextBytes.length} bytes)`);

        // Ensure sender's identity key is saved BEFORE decrypt.
        if (_header?.sender_identity_pub_b64) {
            try {
                const existingKey = await identityStore.getIdentity(address);
                if (!existingKey) {
                    const senderIdKeyBytes = new Uint8Array(Buffer.from(_header.sender_identity_pub_b64, 'base64'));
                    const senderIdKey = PublicKey._fromSerialized(senderIdKeyBytes);
                    await identityStore.saveIdentity(address, senderIdKey);
                }
            } catch (_idErr: any) {
                // non-fatal
            }
        }

        // Actual decryption
        plaintext = await signalDecrypt(signalMsg, address, sessionStore, identityStore);

        const decryptedTextW = Buffer.from(plaintext).toString('utf-8');
        console.log(`  Decrypted plaintext        : "${decryptedTextW.substring(0, 50)}${decryptedTextW.length > 50 ? '…' : ''}" (${decryptedTextW.length} bytes)`);
        console.log(`[Signal🔐] ✅ Whisper decrypt successful`);
        console.log(LINE + '\n');

    } else {
        // Legacy fallback: header doesn't contain message_type (older messages)
        // Try PreKey first, then Whisper
        try {
            const preKeyMsg = PreKeySignalMessage._fromSerialized(ciphertextBytes);
            plaintext = await signalDecryptPreKey(
                preKeyMsg,
                address,
                sessionStore,
                identityStore,
                preKeyStore,
                signedPreKeyStore,
                kyberPreKeyStore,
                [],
            );
        } catch (_preKeyErr: any) {
            // Only fall through to Whisper if PreKey PARSING failed,
            // not if decryption itself failed
            try {
                const signalMsg = SignalMessage._fromSerialized(ciphertextBytes);
                plaintext = await signalDecrypt(signalMsg, address, sessionStore, identityStore);
            } catch (_whisperErr: any) {
                // Both failed — throw the more descriptive error
                throw _preKeyErr;
            }
        }
    }

    return Buffer.from(plaintext).toString('utf-8');
}

/**
 * Check if a session exists with a peer.
 */
export async function hasSession(peerUserId: number, peerDeviceId: number = 1): Promise<boolean> {
    const address = new ProtocolAddress(peerUserId.toString(), peerDeviceId);
    const session = await sessionStore.getSession(address);
    return session !== null && session.hasCurrentState();
}

/**
 * Invalidate (delete) the session with a peer.
 */
export async function invalidateSession(peerUserId: number, peerDeviceId: number = 1): Promise<void> {
    const address = new ProtocolAddress(peerUserId.toString(), peerDeviceId);
    const session = await sessionStore.getSession(address);
    if (session) {
        session.archiveCurrentState();
        await sessionStore.saveSession(address, session);
    }
}

/**
 * Get the local identity public key (base64).
 */
export async function getIdentityPublicKeyB64(): Promise<string> {
    if (!cachedIdentity) throw new Error('SignalManager not initialized');
    return Buffer.from(cachedIdentity!.identityKeyPair.publicKey.serialized).toString('base64');
}

/**
 * Get the local registration ID.
 */
export async function getRegistrationId(): Promise<number> {
    if (!cachedIdentity) throw new Error('SignalManager not initialized');
    return cachedIdentity!.registrationId;
}

/**
 * Clear all Signal data on logout / account reset / device removal.
 * Deletes identity key from Keychain and all Signal data from AsyncStorage.
 * This forces a fresh identity on next login.
 */
export async function clearAll(): Promise<void> {
    // Delete identity key from Keychain + all Signal data from AsyncStorage
    if (cachedIdentity) {
        await clearSignalStorage(cachedIdentity.userId);
    }
    cachedIdentity = null;
    // Reset store singletons to prevent stale references on re-login
    identityStore = undefined as any;
    sessionStore = undefined as any;
    preKeyStore = undefined as any;
    signedPreKeyStore = undefined as any;
    kyberPreKeyStore = undefined as any;
}
