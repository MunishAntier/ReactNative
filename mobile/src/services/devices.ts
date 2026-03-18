/**
 * Device management service for fan-out encryption.
 * Fetches device lists from server (Rule 1 — never cache device lists).
 */
import { apiFetch } from './api';

/** A single device's key bundle, as returned by GET /users/:id/devices */
export interface DeviceBundle {
    device_id: number;
    user_id: number;
    platform: string;
    registration_id: number;
    identity_public_key: string;
    identity_key_version: number;
    signed_prekey_id: number;
    signed_prekey_public: string;
    signed_prekey_signature: string;
    one_time_prekey_id?: number;
    one_time_prekey_public?: string;
}

/** Minimal device info (from GET /devices/me) */
export interface MyDevice {
    id: number;
    user_id: number;
    device_uuid: string;
    platform: string;
    is_active: boolean;
    last_seen_at?: string;
    created_at: string;
    updated_at: string;
}

/**
 * Fetch ALL active devices + key bundles for a peer user (Rule 1).
 * Always fetches fresh from server — never cached.
 */
export async function fetchPeerDevices(userId: number): Promise<DeviceBundle[]> {
    const res = await apiFetch(`/users/${userId}/devices`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch devices for user ${userId}`);
    }
    const data = await res.json();
    return data.devices || [];
}

/**
 * Fetch current user's active devices (for self-sync, Rule 5).
 * Always fetches fresh from server.
 */
export async function fetchMyDevices(): Promise<MyDevice[]> {
    const res = await apiFetch('/devices/me');
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch own devices');
    }
    const data = await res.json();
    return data.devices || [];
}

/**
 * Unlink (deactivate) a device (Rule 13).
 */
export async function unlinkDevice(deviceId: number): Promise<void> {
    const res = await apiFetch(`/devices/${deviceId}`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to unlink device ${deviceId}`);
    }
}
