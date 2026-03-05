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

// ────────────────────────── Singleton Stores ──────────────────────────

let identityStore: AppIdentityKeyStore;
let sessionStore: AppSessionStore;
let preKeyStore: AppPreKeyStore;
let signedPreKeyStore: AppSignedPreKeyStore;
let kyberPreKeyStore: AppKyberPreKeyStore;

// Cached identity after initialization
let cachedIdentity: { userId: number; identityKeyPair: IdentityKeyPair; registrationId: number } | null = null;

// ────────────────────────── Public API ──────────────────────────

/**
 * Load or generate the local identity key pair + registration ID for a specific user.
 * Must be called before any other operation.
 */
export async function initialize(userId: number): Promise<boolean> {
    if (cachedIdentity?.userId === userId) return false;

    // Diagnostic: check native module methods
    try {
        const native = require('react-native-libsignal-client/src/ReactNativeLibsignalClientModule').default;
        console.log('[Signal] Native module methods:', Object.keys(native).filter(k => typeof native[k] === 'function'));
    } catch (e) {
        console.warn('[Signal] Could not inspect native module');
    }

    // Migrate any keys stored under the old global prefix
    await migrateOldKeys(userId);

    identityStore = new AppIdentityKeyStore(userId);
    sessionStore = new AppSessionStore(userId);
    preKeyStore = new AppPreKeyStore(userId);
    signedPreKeyStore = new AppSignedPreKeyStore(userId);
    kyberPreKeyStore = new AppKyberPreKeyStore();

    const identity = await initializeIdentity(userId);
    cachedIdentity = { userId, identityKeyPair: identity.identityKeyPair, registrationId: identity.registrationId };
    console.log(`[Signal] Initialized for user ${userId} with regId:`, cachedIdentity.registrationId, identity.isNew ? '(NEW identity)' : '(existing identity)');
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

    await createAndProcessPreKeyBundle(
        peerBundle.registration_id,
        address,
        preKeyId,
        preKey!,
        peerBundle.signed_prekey_id,
        signedPreKey,
        signedPreKeySig,
        identityKey,
        sessionStore,
        identityStore,
        null, // No Kyber pre-keys
    );

    console.log(`[Signal] Session created with user ${peerUserId}`);
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

    console.log(`[Signal] Encrypting for user ${peerUserId}, device ${peerDeviceId}`);

    // Step 1: Check session exists
    const session = await sessionStore.getSession(address);
    if (!session) {
        throw new Error(`No session with user ${peerUserId}. Cannot encrypt.`);
    }

    // Step 2: Check peer identity key exists
    const peerIdentity = await identityStore.getIdentity(address);
    if (!peerIdentity) {
        throw new Error(`No saved identity key for user ${peerUserId}.`);
    }

    // Step 3: Get our own identity key (required by Signal)
    const ownPrivateKey = await identityStore.getIdentityKey();
    if (!ownPrivateKey) throw new Error('Local identity private key missing');

    // Step 4: Call signalEncrypt
    if (typeof signalEncrypt !== 'function') throw new Error('signalEncrypt library function missing');

    const cipherText = await signalEncrypt(message, address, sessionStore, identityStore);
    if (!cipherText) throw new Error('signalEncrypt returned null');

    const ciphertextBytes = cipherText.serialized;
    const msgType = cipherText.type();

    let receiverPreKeyId = 0;
    let messageIndex = 0;

    if (msgType === CiphertextMessageType.PreKey) {
        if (typeof PreKeySignalMessage._fromSerialized !== 'function') throw new Error('PreKeySignalMessage._fromSerialized missing');
        const preKeyMsg = PreKeySignalMessage._fromSerialized(ciphertextBytes);
        receiverPreKeyId = preKeyMsg.preKeyId() ?? 0;
    } else if (msgType === CiphertextMessageType.Whisper) {
        if (typeof SignalMessage._fromSerialized !== 'function') throw new Error('SignalMessage._fromSerialized missing');
        const signalMsg = SignalMessage._fromSerialized(ciphertextBytes);
        messageIndex = signalMsg.counter();
    }

    const ciphertextB64 = Buffer.from(ciphertextBytes).toString('base64');
    const ownPubB64 = Buffer.from(ownPrivateKey.getPublicKey().serialized).toString('base64');
    const ownPrivB64 = Buffer.from(ownPrivateKey.serialized).toString('base64');
    const peerPubB64 = Buffer.from(peerIdentity.serialized).toString('base64');
    console.log(`[Signal] ✉️ ENCRYPT for user ${peerUserId}:`);
    console.log(`  🔑 My Public Key:   ${ownPubB64.substring(0, 40)}...`);
    console.log(`  🔒 My Private Key:  ${ownPrivB64.substring(0, 20)}... (NEVER leaves device)`);
    console.log(`  🔑 Peer Public Key: ${peerPubB64.substring(0, 40)}...`);
    console.log(`  📝 Plaintext: "${plaintext}"`);
    console.log(`  🔐 Ciphertext: ${ciphertextB64.substring(0, 60)}...`);
    console.log(`  📦 Type: ${msgType === CiphertextMessageType.PreKey ? 'PreKey (first message)' : 'Whisper (ongoing)'}`);

    return {
        ciphertext_b64: ciphertextB64,
        header: {
            session_version: 3,
            sender_identity_pub_b64: Buffer.from(
                cachedIdentity!.identityKeyPair.publicKey.serialized,
            ).toString('base64'),
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

    try {
        // Try to parse as PreKeySignalMessage first
        const preKeyMsg = PreKeySignalMessage._fromSerialized(ciphertextBytes);
        plaintext = await signalDecryptPreKey(
            preKeyMsg,
            address,
            sessionStore,
            identityStore,
            preKeyStore,
            signedPreKeyStore,
            kyberPreKeyStore,
            [], // no kyber pre-key IDs
        );
        const myPrivKey = await identityStore.getIdentityKey();
        const myPubB64 = Buffer.from(myPrivKey.getPublicKey().serialized).toString('base64');
        const myPrivB64 = Buffer.from(myPrivKey.serialized).toString('base64');
        const senderPubKey = await identityStore.getIdentity(address);
        const senderPubB64 = senderPubKey ? Buffer.from(senderPubKey.serialized).toString('base64') : 'unknown';
        console.log(`[Signal] 🔓 DECRYPT PreKey message from user ${senderUserId}:`);
        console.log(`  🔑 My Public Key:     ${myPubB64.substring(0, 40)}...`);
        console.log(`  🔒 My Private Key:    ${myPrivB64.substring(0, 20)}... (used to decrypt)`);
        console.log(`  🔑 Sender Public Key: ${senderPubB64.substring(0, 40)}...`);
        console.log(`  🔐 Ciphertext: ${ciphertextB64.substring(0, 60)}...`);
        console.log(`  📝 Plaintext: "${Buffer.from(plaintext).toString('utf-8')}"`);
    } catch {
        // If that fails, parse as regular SignalMessage
        try {
            const signalMsg = SignalMessage._fromSerialized(ciphertextBytes);
            plaintext = await signalDecrypt(signalMsg, address, sessionStore, identityStore);
            console.log(`[Signal] 🔓 DECRYPT Signal message from user ${senderUserId}:`);
            console.log(`  🔒 Ciphertext: ${ciphertextB64.substring(0, 60)}...`);
            console.log(`  📝 Plaintext: "${Buffer.from(plaintext).toString('utf-8')}"`);
        } catch (err: any) {
            console.error(`[Signal] Decryption failed for user ${senderUserId}:`, err.message);
            throw err;
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
    console.log(`[Signal] Session invalidated with user ${peerUserId}`);
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
 * Reset the cached identity on logout.
 * Keys are NOT deleted from storage so pending messages can be decrypted
 * when the same user logs back in on this device.
 */
export async function clearAll(): Promise<void> {
    cachedIdentity = null;
    console.log('[Signal] Session cache cleared (keys preserved in storage)');
}
