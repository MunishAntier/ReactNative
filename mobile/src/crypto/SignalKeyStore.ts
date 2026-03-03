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
const KEY_IDENTITY = `${PREFIX}identity_keypair`;
const KEY_REG_ID = `${PREFIX}registration_id`;
const KEY_SESSION = `${PREFIX}session:`;
const KEY_PREKEY = `${PREFIX}prekey:`;
const KEY_SIGNED_PREKEY = `${PREFIX}signed_prekey:`;
const KEY_TRUSTED_IDENTITY = `${PREFIX}trusted_id:`;
const KEY_SIGNED_PREKEY_CURRENT_ID = `${PREFIX}signed_prekey_current_id`;
const KEY_PREKEY_COUNTER = `${PREFIX}prekey_counter`;

// ────────────────────────── Helpers ──────────────────────────

function addressKey(addr: ProtocolAddress): string {
    return `${addr.name}:${addr.deviceId}`;
}

async function setBytes(key: string, data: Uint8Array): Promise<void> {
    const b64 = Buffer.from(data).toString('base64');
    await AsyncStorage.setItem(key, b64);
}

async function getBytes(key: string): Promise<Uint8Array | null> {
    const b64 = await AsyncStorage.getItem(key);
    if (!b64) return null;
    return new Uint8Array(Buffer.from(b64, 'base64'));
}

// ────────────────────────── Identity Key Store ──────────────────────────

export class AppIdentityKeyStore extends IdentityKeyStore {
    async getIdentityKey(): Promise<PrivateKey> {
        const raw = await getBytes(KEY_IDENTITY);
        if (!raw) throw new Error('Identity key not initialized');
        const pair = IdentityKeyPair.deserialize(raw);
        return pair.privateKey;
    }

    async getLocalRegistrationId(): Promise<number> {
        const val = await AsyncStorage.getItem(KEY_REG_ID);
        if (!val) throw new Error('Registration ID not initialized');
        return parseInt(val, 10);
    }

    async saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean> {
        const storageKey = `${KEY_TRUSTED_IDENTITY}${addressKey(name)}`;
        const existing = await getBytes(storageKey);
        await setBytes(storageKey, key.serialized);
        // Return true if identity key changed (replacing an existing one)
        if (existing) {
            const oldB64 = Buffer.from(existing).toString('base64');
            const newB64 = Buffer.from(key.serialized).toString('base64');
            if (oldB64 !== newB64) {
                return true;
            }
        }
        return false;
    }

    async isTrustedIdentity(
        _name: ProtocolAddress,
        _key: PublicKey,
        _direction: Direction,
    ): Promise<boolean> {
        // Trust on first use (TOFU)
        return true;
    }

    async getIdentity(name: ProtocolAddress): Promise<PublicKey | null> {
        const raw = await getBytes(`${KEY_TRUSTED_IDENTITY}${addressKey(name)}`);
        if (!raw) return null;
        return PublicKey._fromSerialized(raw);
    }
}

// ────────────────────────── Session Store ──────────────────────────

export class AppSessionStore extends SessionStore {
    async saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void> {
        await setBytes(`${KEY_SESSION}${addressKey(name)}`, record.serialized);
    }

    async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
        const raw = await getBytes(`${KEY_SESSION}${addressKey(name)}`);
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
    async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
        await setBytes(`${KEY_PREKEY}${id}`, record.serialized);
    }

    async getPreKey(id: number): Promise<PreKeyRecord> {
        const raw = await getBytes(`${KEY_PREKEY}${id}`);
        if (!raw) throw new Error(`PreKey ${id} not found`);
        return PreKeyRecord._fromSerialized(raw);
    }

    async removePreKey(id: number): Promise<void> {
        await AsyncStorage.removeItem(`${KEY_PREKEY}${id}`);
    }
}

// ────────────────────────── Signed Pre-Key Store ──────────────────────────

export class AppSignedPreKeyStore extends SignedPreKeyStore {
    async saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
        await setBytes(`${KEY_SIGNED_PREKEY}${id}`, record.serialized);
    }

    async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
        const raw = await getBytes(`${KEY_SIGNED_PREKEY}${id}`);
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
export async function initializeIdentity(): Promise<{
    identityKeyPair: IdentityKeyPair;
    registrationId: number;
}> {
    const existing = await getBytes(KEY_IDENTITY);
    if (existing) {
        const pair = IdentityKeyPair.deserialize(existing);
        const regId = parseInt((await AsyncStorage.getItem(KEY_REG_ID)) || '0', 10);
        return { identityKeyPair: pair, registrationId: regId };
    }

    // Generate new identity
    const { generateRegistrationID } = require('react-native-libsignal-client');
    const pair = IdentityKeyPair.generate();
    const regId = generateRegistrationID();

    await setBytes(KEY_IDENTITY, pair.serialize());
    await AsyncStorage.setItem(KEY_REG_ID, regId.toString());

    return { identityKeyPair: pair, registrationId: regId };
}

/**
 * Get (and increment) the pre-key counter for unique IDs.
 */
export async function getNextPreKeyId(): Promise<number> {
    const val = await AsyncStorage.getItem(KEY_PREKEY_COUNTER);
    const current = val ? parseInt(val, 10) : 1;
    await AsyncStorage.setItem(KEY_PREKEY_COUNTER, (current + 1).toString());
    return current;
}

/**
 * Get the current signed pre-key ID.
 */
export async function getCurrentSignedPreKeyId(): Promise<number> {
    const val = await AsyncStorage.getItem(KEY_SIGNED_PREKEY_CURRENT_ID);
    return val ? parseInt(val, 10) : 0;
}

/**
 * Set the current signed pre-key ID.
 */
export async function setCurrentSignedPreKeyId(id: number): Promise<void> {
    await AsyncStorage.setItem(KEY_SIGNED_PREKEY_CURRENT_ID, id.toString());
}

/**
 * Clear all Signal-related storage. Used when user logs out or reinstalls.
 */
export async function clearSignalStorage(): Promise<void> {
    const allKeys = await AsyncStorage.getAllKeys();
    const signalKeys = allKeys.filter(k => k.startsWith(PREFIX));
    for (const key of signalKeys) {
        await AsyncStorage.removeItem(key);
    }
}
