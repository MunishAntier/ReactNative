import { apiFetch, saveTokens, clearTokens } from './api';

export interface AuthStartResponse {
    message: string;
    otp_dev?: string; // exposed only in development mode
}

export interface AuthVerifyResponse {
    user_id: number;
    device_id: number;
    access_token: string;
    refresh_token: string;
    is_new_device: boolean;
}

/**
 * Start OTP authentication flow.
 * @param identifier - email or phone number
 */
export async function startAuth(identifier: string): Promise<AuthStartResponse> {
    const res = await fetch('http://10.0.2.2:8080/v1/auth/start', {
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
    const res = await fetch('http://10.0.2.2:8080/v1/auth/verify', {
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
}

/**
 * Get current user info.
 */
export async function getMe(): Promise<any> {
    const res = await apiFetch('/me');
    if (!res.ok) throw new Error('Failed to fetch user info');
    return res.json();
}

/**
 * Lookup a user by email or phone.
 */
export async function lookupUser(identifier: string): Promise<any> {
    const res = await apiFetch(`/users/lookup?identifier=${encodeURIComponent(identifier)}`);
    if (!res.ok) throw new Error('User not found');
    return res.json();
}
