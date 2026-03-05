/**
 * SignalKeyStore — AsyncStorage-backed implementations of the Signal Protocol stores.
 *
 * Implements:
 *  - IdentityKeyStore (our own identity + trusted peer identities)
 *  - SessionStore     (per-peer session state for Double Ratchet)
 *  - PreKeyStore      (one-time pre-key private keys)
 *  - SignedPreKeyStore (signed pre-key private keys)
 *  - KyberPreKeyStore (stub — required by API but not used)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    IdentityKeyStore,
    SessionStore,
    PreKeyStore,
    SignedPreKeyStore,
    KyberPreKeyStore,
    IdentityKeyPair,
    PrivateKey,
    PublicKey,
    PreKeyRecord,
    SignedPreKeyRecord,
    KyberPreKeyRecord,
    SessionRecord,
    ProtocolAddress,
    Direction,
} from 'react-native-libsignal-client';

// Storage key prefixes
const PREFIX = 'signal:';

function getUserPrefix(userId: number | string): string {
    return `${PREFIX}${userId}:`;
}

const KEY_IDENTITY = 'identity_keypair';
const KEY_REG_ID = 'registration_id';
const KEY_SESSION = 'session:';
const KEY_PREKEY = 'prekey:';
const KEY_SIGNED_PREKEY = 'signed_prekey:';
const KEY_TRUSTED_IDENTITY = 'trusted_id:';
const KEY_SIGNED_PREKEY_CURRENT_ID = 'signed_prekey_current_id';
const KEY_PREKEY_COUNTER = 'prekey_counter';

// ────────────────────────── Helpers ──────────────────────────

function addressKey(addr: ProtocolAddress): string {
    return `${addr.name}:${addr.deviceId}`;
}

async function setBytes(key: string, data: Uint8Array, userId: number): Promise<void> {
    const b64 = Buffer.from(data).toString('base64');
    await AsyncStorage.setItem(`${getUserPrefix(userId)}${key}`, b64);
}

async function getBytes(key: string, userId: number): Promise<Uint8Array | null> {
    const b64 = await AsyncStorage.getItem(`${getUserPrefix(userId)}${key}`);
    if (!b64) return null;
    return new Uint8Array(Buffer.from(b64, 'base64'));
}

// ────────────────────────── Identity Key Store ──────────────────────────

export class AppIdentityKeyStore extends IdentityKeyStore {
    constructor(private userId: number) {
        super();
    }

    async getIdentityKey(): Promise<PrivateKey> {
        const raw = await getBytes(KEY_IDENTITY, this.userId);
        if (!raw) throw new Error('Identity key not initialized');

        // Ensure we return a real PrivateKey instance with all methods
        const pair = IdentityKeyPair.deserialize(raw);
        return PrivateKey._fromSerialized(pair.privateKey.serialized);
    }

    async getLocalRegistrationId(): Promise<number> {
        const val = await AsyncStorage.getItem(`${getUserPrefix(this.userId)}${KEY_REG_ID}`);
        if (!val) throw new Error('Registration ID not initialized');
        return parseInt(val, 10);
    }

    async saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean> {
        const storageKey = `${KEY_TRUSTED_IDENTITY}${addressKey(name)}`;
        const existing = await getBytes(storageKey, this.userId);
        await setBytes(storageKey, key.serialized, this.userId);

        // Return true if identity key changed (replacing an existing one)
        if (existing) {
            const oldB64 = Buffer.from(existing).toString('base64');
            const newB64 = Buffer.from(key.serialized).toString('base64');
            return oldB64 !== newB64;
        }
        return false;
    }

    async isTrustedIdentity(
        name: ProtocolAddress,
        key: PublicKey,
        direction: Direction
    ): Promise<boolean> {
        // For outgoing (Sending) direction: always trust.
        // We are the initiator in X3DH — we trust the server-provided bundle.
        // TOFU enforcement is only meaningful for incoming messages.
        if (direction === Direction.Sending) {
            return true;
        }

        // For incoming (Receiving) direction: Trust On First Use.
        // Accept the first key seen, reject if it changes.
        const existing = await this.getIdentity(name);
        if (!existing) {
            // First time seeing this sender — trust automatically
            return true;
        }
        const existingB64 = Buffer.from(existing.serialized).toString('base64');
        const newB64 = Buffer.from(key.serialized).toString('base64');
        if (existingB64 !== newB64) {
            console.warn(`[Signal] TOFU: Identity key CHANGED for ${name.name}:${name.deviceId}`);
            return false;
        }
        return true;
    }

    async getIdentity(address: ProtocolAddress): Promise<PublicKey | null> {
        const raw = await getBytes(`${KEY_TRUSTED_IDENTITY}${addressKey(address)}`, this.userId);
        if (!raw) return null;
        return PublicKey._fromSerialized(raw);
    }
}

// ────────────────────────── Session Store ──────────────────────────

export class AppSessionStore extends SessionStore {
    constructor(private userId: number) {
        super();
    }

    async saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void> {
        await setBytes(`${KEY_SESSION}${addressKey(name)}`, record.serialized, this.userId);
    }

    async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
        const raw = await getBytes(`${KEY_SESSION}${addressKey(name)}`, this.userId);
        if (!raw) return null;
        return SessionRecord._fromSerialized(raw);
    }

    async getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]> {
        const results: SessionRecord[] = [];
        for (const addr of addresses) {
            const session = await this.getSession(addr);
            if (session) results.push(session);
        }
        return results;
    }
}

// ────────────────────────── Pre-Key Store ──────────────────────────

export class AppPreKeyStore extends PreKeyStore {
    constructor(private userId: number) {
        super();
    }

    async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
        await setBytes(`${KEY_PREKEY}${id}`, record.serialized, this.userId);
    }

    async getPreKey(id: number): Promise<PreKeyRecord> {
        const raw = await getBytes(`${KEY_PREKEY}${id}`, this.userId);
        if (!raw) throw new Error(`PreKey ${id} not found`);
        return PreKeyRecord._fromSerialized(raw);
    }

    async removePreKey(id: number): Promise<void> {
        await AsyncStorage.removeItem(`${getUserPrefix(this.userId)}${KEY_PREKEY}${id}`);
    }
}

// ────────────────────────── Signed Pre-Key Store ──────────────────────────

export class AppSignedPreKeyStore extends SignedPreKeyStore {
    constructor(private userId: number) {
        super();
    }

    async saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
        await setBytes(`${KEY_SIGNED_PREKEY}${id}`, record.serialized, this.userId);
    }

    async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
        const raw = await getBytes(`${KEY_SIGNED_PREKEY}${id}`, this.userId);
        if (!raw) throw new Error(`SignedPreKey ${id} not found`);
        return SignedPreKeyRecord._fromSerialized(raw);
    }
}

// ────────────────────────── Kyber Pre-Key Store (stub) ──────────────────────────

export class AppKyberPreKeyStore extends KyberPreKeyStore {
    async saveKyberPreKey(_id: number, _record: KyberPreKeyRecord): Promise<void> {
        // Not used in this implementation
    }
    async getKyberPreKey(id: number): Promise<KyberPreKeyRecord> {
        throw new Error(`KyberPreKey ${id} not available`);
    }
    async markKyberPreKeyUsed(_id: number): Promise<void> {
        // Not used
    }
}

// ────────────────────────── Utility functions ──────────────────────────

/**
 * Initialize (generate) and store the identity key pair + registration ID.
 * Returns the pair if newly generated, or loads an existing one.
 */
export async function initializeIdentity(userId: number): Promise<{
    identityKeyPair: IdentityKeyPair;
    registrationId: number;
    isNew: boolean;
}> {
    const existing = await getBytes(KEY_IDENTITY, userId);
    if (existing) {
        const pair = IdentityKeyPair.deserialize(existing);
        const regId = parseInt((await AsyncStorage.getItem(`${getUserPrefix(userId)}${KEY_REG_ID}`)) || '0', 10);
        return { identityKeyPair: pair, registrationId: regId, isNew: false };
    }

    // Generate new identity
    const { generateRegistrationID } = await import('react-native-libsignal-client');
    const pair = IdentityKeyPair.generate();
    const regId = generateRegistrationID();

    await setBytes(KEY_IDENTITY, pair.serialize(), userId);
    await AsyncStorage.setItem(`${getUserPrefix(userId)}${KEY_REG_ID}`, regId.toString());

    return { identityKeyPair: pair, registrationId: regId, isNew: true };
}

// Pre-key counter lock to prevent concurrent increments (Issue 10)
let _preKeyIdPromise: Promise<number> = Promise.resolve(0);

/**
 * Get (and increment) the pre-key counter for unique IDs.
 * Uses a sequential promise chain to avoid race conditions.
 */
export async function getNextPreKeyId(userId: number): Promise<number> {
    const result = _preKeyIdPromise.then(async () => {
        const val = await AsyncStorage.getItem(`${getUserPrefix(userId)}${KEY_PREKEY_COUNTER}`);
        const current = val ? parseInt(val, 10) : 1;
        await AsyncStorage.setItem(`${getUserPrefix(userId)}${KEY_PREKEY_COUNTER}`, (current + 1).toString());
        return current;
    });
    _preKeyIdPromise = result.catch(() => 0); // Reset chain on error
    return result;
}

/**
 * Get the current signed pre-key ID.
 */
export async function getCurrentSignedPreKeyId(userId: number): Promise<number> {
    const val = await AsyncStorage.getItem(`${getUserPrefix(userId)}${KEY_SIGNED_PREKEY_CURRENT_ID}`);
    return val ? parseInt(val, 10) : 0;
}

/**
 * Set the current signed pre-key ID.
 */
export async function setCurrentSignedPreKeyId(userId: number, id: number): Promise<void> {
    await AsyncStorage.setItem(`${getUserPrefix(userId)}${KEY_SIGNED_PREKEY_CURRENT_ID}`, id.toString());
}

/**
 * Clear all Signal-related storage for a specific user.
 */
export async function clearSignalStorage(userId: number): Promise<void> {
    const prefix = getUserPrefix(userId);
    const allKeys = await AsyncStorage.getAllKeys();
    const signalKeys = allKeys.filter(k => k.startsWith(prefix));
    for (const key of signalKeys) {
        await AsyncStorage.removeItem(key);
    }
}

/**
 * Migrate keys from the old global `signal:` prefix to the new user-scoped
 * `signal:${userId}:` prefix. This is needed because keys generated before
 * the user-scoped refactoring are stored under `signal:key_name` instead of
 * `signal:${userId}:key_name`. Without migration, the receiver cannot find
 * its own private keys and decryption fails with "No Identity Key".
 *
 * This function is idempotent — safe to call multiple times.
 */
export async function migrateOldKeys(userId: number): Promise<void> {
    const allKeys = await AsyncStorage.getAllKeys();
    const newPrefix = getUserPrefix(userId); // e.g. "signal:42:"

    // Find keys that start with "signal:" but NOT with "signal:<digits>:"
    // i.e. old-format keys like "signal:identity_keypair", "signal:prekey:1", etc.
    const oldFormatKeys = allKeys.filter(k => {
        if (!k.startsWith(PREFIX)) return false;
        // Skip if it already has the user-scoped pattern "signal:<number>:"
        const afterPrefix = k.slice(PREFIX.length);
        const colonIndex = afterPrefix.indexOf(':');
        if (colonIndex > 0) {
            const maybeUserId = afterPrefix.slice(0, colonIndex);
            if (/^\d+$/.test(maybeUserId)) return false; // already user-scoped
        }
        // Also skip if entire afterPrefix is a number (edge case)
        if (/^\d+$/.test(afterPrefix)) return false;
        return true;
    });

    if (oldFormatKeys.length === 0) {
        return; // nothing to migrate
    }

    console.log(`[Signal] Migrating ${oldFormatKeys.length} keys from old format to user ${userId}`);

    for (const oldKey of oldFormatKeys) {
        const suffix = oldKey.slice(PREFIX.length); // e.g. "identity_keypair"
        const newKey = `${newPrefix}${suffix}`;     // e.g. "signal:42:identity_keypair"

        // Only migrate if the new key doesn't already exist
        const existingNew = await AsyncStorage.getItem(newKey);
        if (existingNew === null) {
            const value = await AsyncStorage.getItem(oldKey);
            if (value !== null) {
                await AsyncStorage.setItem(newKey, value);
                console.log(`[Signal]   Migrated: ${oldKey} → ${newKey}`);
            }
        }

        // Remove the old key after migration
        await AsyncStorage.removeItem(oldKey);
    }

    console.log('[Signal] Key migration complete');
}
