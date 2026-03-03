import { NativeModules } from 'react-native';
import { apiFetch } from './api';

const { SignalBridge } = NativeModules;

export interface KeyBundle {
    registration_id: number;
    identity_public_key: string;
    identity_key_version: number;
    signed_prekey_id: number;
    signed_prekey_public: string;
    signed_prekey_signature: string;
    signed_prekey_expires_at: string;
    one_time_prekeys: Array<{ prekey_id: number; prekey_public: string }>;
}

export interface PeerKeyBundle {
    user_id: number;
    device_id: number;
    registration_id: number;
    identity_public_key: string;
    identity_key_version: number;
    signed_prekey_id: number;
    signed_prekey_public: string;
    signed_prekey_signature: string;
    one_time_prekey_id: number;
    one_time_prekey_public: string;
}

/**
 * Generate initial key bundle and upload to server.
 * Called once on first login (when is_new_device is true).
 */
export async function generateAndUploadKeys(oneTimePreKeyCount: number = 100): Promise<KeyBundle> {
    const bundle: KeyBundle = await SignalBridge.generateInitialBundle(oneTimePreKeyCount);

    const res = await apiFetch('/keys/upload', {
        method: 'POST',
        body: JSON.stringify(bundle),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Key upload failed');
    }
    return bundle;
}

/**
 * Generate and upload additional one-time pre-keys.
 * Called when server sends `prekey.low` WebSocket notification.
 */
export async function replenishOneTimePreKeys(count: number = 100): Promise<void> {
    const keys = await SignalBridge.generateOneTimePreKeys(count);

    const res = await apiFetch('/keys/one-time-prekeys/upload', {
        method: 'POST',
        body: JSON.stringify({ one_time_prekeys: keys }),
    });
    if (!res.ok) {
        throw new Error('Failed to upload one-time pre-keys');
    }
}

/**
 * Rotate signed pre-key and upload to server.
 * Should be called periodically (every 30 days) or on reinstall.
 */
export async function rotateSignedPreKey(): Promise<void> {
    const result = await SignalBridge.rotateSignedPreKey();

    const res = await apiFetch('/keys/signed-prekey/rotate', {
        method: 'POST',
        body: JSON.stringify({
            signed_prekey_id: result.signed_prekey_id,
            signed_prekey_public: result.signed_prekey_public,
            signed_prekey_signature: result.signed_prekey_signature,
            signed_prekey_expires_at: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
        }),
    });
    if (!res.ok) {
        throw new Error('Failed to rotate signed pre-key');
    }
}

/**
 * Fetch a peer's public key bundle from the server.
 * The server marks the used one-time pre-key.
 */
export async function fetchPeerKeyBundle(userId: number): Promise<PeerKeyBundle> {
    const res = await apiFetch(`/keys/${userId}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch key bundle');
    }
    return res.json();
}
