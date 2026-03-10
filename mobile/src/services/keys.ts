import * as SignalManager from '../crypto/SignalManager';
import { apiFetch } from './api';

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
 * Called once on first login (when no keys exist on server).
 */
export async function generateAndUploadKeys(userId: number, oneTimePreKeyCount: number = 100): Promise<KeyBundle> {
    await SignalManager.initialize(userId);
    const bundle = await SignalManager.generateInitialBundle(userId, oneTimePreKeyCount);

    const res = await apiFetch('/keys/upload', {
        method: 'POST',
        body: JSON.stringify(bundle),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Key upload failed');
    }
    console.log('[Keys] Initial bundle uploaded');
    return bundle;
}

/**
 * Generate and upload additional one-time pre-keys.
 * Called when server sends `prekeys.low` WebSocket notification.
 */
export async function replenishOneTimePreKeys(userId: number, count: number = 100): Promise<void> {
    const keys = await SignalManager.generateOneTimePreKeys(userId, count);

    const res = await apiFetch('/keys/one-time-prekeys/upload', {
        method: 'POST',
        body: JSON.stringify({ one_time_prekeys: keys }),
    });
    if (!res.ok) {
        throw new Error('Failed to upload one-time pre-keys');
    }
    console.log(`[Keys] Replenished ${count} one-time pre-keys`);
}

/**
 * Check server-side pre-key count and replenish if below threshold.
 * Called on login and WebSocket reconnect to cover the case where
 * 'prekeys.low' events were missed while the device was offline.
 */
export async function checkAndReplenishPreKeys(userId: number, threshold: number = 20): Promise<void> {
    try {
        const res = await apiFetch('/keys/prekey-count');
        if (!res.ok) {
            console.warn('[Keys] Failed to check pre-key count:', res.status);
            return;
        }
        const data = await res.json();
        const count = data.count as number;
        console.log(`[Keys] Server pre-key count: ${count}`);
        if (count < threshold) {
            console.log(`[Keys] Below threshold (${threshold}), replenishing...`);
            await replenishOneTimePreKeys(userId);
        }
    } catch (err) {
        console.warn('[Keys] Failed to check/replenish pre-keys:', err);
    }
}

/**
 * Rotate signed pre-key and upload to server.
 * Should be called periodically (every 30 days) or on reinstall.
 */
export async function rotateSignedPreKey(userId: number): Promise<void> {
    const result = await SignalManager.rotateSignedPreKey(userId);

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
    console.log('[Keys] Signed pre-key rotated');
}

/**
 * Fetch a peer's public key bundle from the server.
 * The server picks and reserves one of their one-time pre-keys.
 */
export async function fetchPeerKeyBundle(userId: number): Promise<PeerKeyBundle> {
    const res = await apiFetch(`/keys/${userId}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err.error || 'Failed to fetch key bundle';
        if (res.status === 404) {
            throw new Error(`BUNDLE_NOT_FOUND: User ${userId} has no keys on the server.`);
        }
        throw new Error(message);
    }
    return res.json();
}

/**
 * Check if current user's keys are on the server; if not, upload them.
 */
export async function checkAndUploadKeys(userId: number): Promise<void> {
    try {
        console.log(`[Keys] Checking if keys for user ${userId} exist on server...`);
        await fetchPeerKeyBundle(userId);
        console.log('[Keys] Keys found on server');
    } catch (err: any) {
        if (err.message?.includes('BUNDLE_NOT_FOUND')) {
            console.warn('[Keys] Keys missing on server, uploading now...');
            await generateAndUploadKeys(userId);
        } else {
            console.error('[Keys] Failed to check for existing keys:', err.message);
        }
    }
}
