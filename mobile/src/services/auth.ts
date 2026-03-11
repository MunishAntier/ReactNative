import { apiFetch, saveTokens, clearTokens } from './api';
import { API_BASE_URL } from './config';
import Keychain from 'react-native-keychain';

export interface AuthStartResponse {
    identifier: string;
    purpose: string;
    otp_ttl_seconds: number;
    dev_otp?: string; // exposed only in development mode
}

export interface AuthVerifyResponse {
    user_id: number;
    device_id: number;
    session_id: string;
    access_token: string;
    access_expires_at: string;
    refresh_token: string;
    refresh_expires_at: string;
}

const USER_INFO_SERVICE = 'securemsg_user_info';
const DEVICE_UUID_SERVICE = 'securemsg_device_uuid';

/**
 * Persist user info (userId, deviceId) so we can restore after app relaunch.
 */
async function saveUserInfo(userId: number, deviceId: number): Promise<void> {
    await Keychain.setGenericPassword(
        'user_info',
        JSON.stringify({ userId, deviceId }),
        { service: USER_INFO_SERVICE },
    );
}

export async function getOrCreateStableDeviceUuid(platform: string): Promise<string> {
    try {
        const creds = await Keychain.getGenericPassword({ service: DEVICE_UUID_SERVICE });
        if (creds && typeof creds === 'object' && 'password' in creds && creds.password) {
            return creds.password;
        }
    } catch { }

    const deviceUuid = `${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await Keychain.setGenericPassword('device_uuid', deviceUuid, {
        service: DEVICE_UUID_SERVICE,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    return deviceUuid;
}

/**
 * Load persisted user info.
 */
export async function loadUserInfo(): Promise<{ userId: number; deviceId: number } | null> {
    try {
        const creds = await Keychain.getGenericPassword({ service: USER_INFO_SERVICE });
        if (creds) {
            return JSON.parse(creds.password);
        }
    } catch { }
    return null;
}

/**
 * Start OTP authentication flow.
 * @param identifier - email or phone number
 */
export async function startAuth(identifier: string): Promise<AuthStartResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Auth start failed (${res.status})`);
    }
    return res.json();
}

/**
 * Verify OTP and receive JWT tokens.
 */
export async function verifyOTP(
    identifier: string,
    otp: string,
    deviceUuid: string,
    platform: string = 'android',
): Promise<AuthVerifyResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            identifier,
            otp,
            device_uuid: deviceUuid,
            platform,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `OTP verify failed (${res.status})`);
    }
    const data: AuthVerifyResponse = await res.json();
    await saveTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
    });
    await saveUserInfo(data.user_id, data.device_id);
    return data;
}

/**
 * Logout and clear tokens.
 */
export async function logout(): Promise<void> {
    try {
        await apiFetch('/auth/logout', { method: 'POST' });
    } catch { }
    await clearTokens();
    await Keychain.resetGenericPassword({ service: USER_INFO_SERVICE });
}

/**
 * Get current user info from the server.
 */
export async function getMe(): Promise<{ id: number; email?: string; phone?: string }> {
    const res = await apiFetch('/me');
    if (!res.ok) throw new Error('Failed to fetch user info');
    return res.json();
}

/**
 * Lookup a user by email or phone.
 */
export async function lookupUser(identifier: string): Promise<{ id: number; email?: string; phone?: string }> {
    const res = await apiFetch(`/users/lookup?identifier=${encodeURIComponent(identifier)}`);
    if (!res.ok) throw new Error('User not found');
    return res.json();
}
