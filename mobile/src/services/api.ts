import Keychain from 'react-native-keychain';
import { API_BASE_URL } from './config';

const BASE_URL = API_BASE_URL;

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

let tokenPair: TokenPair | null = null;
let refreshPromise: Promise<TokenPair | null> | null = null;

export async function loadTokens(): Promise<TokenPair | null> {
    if (tokenPair) return tokenPair;
    try {
        const creds = await Keychain.getGenericPassword({ service: 'securemsg_tokens' });
        if (creds) {
            tokenPair = JSON.parse(creds.password);
            return tokenPair;
        }
    } catch { }
    return null;
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
    tokenPair = tokens;
    await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), {
        service: 'securemsg_tokens',
    });
}

export async function clearTokens(): Promise<void> {
    tokenPair = null;
    await Keychain.resetGenericPassword({ service: 'securemsg_tokens' });
}

export function getAccessToken(): string | null {
    return tokenPair?.accessToken ?? null;
}

async function refreshAccessToken(): Promise<TokenPair | null> {
    if (!tokenPair?.refreshToken) return null;
    try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: tokenPair.refreshToken }),
        });
        if (!res.ok) {
            await clearTokens();
            return null;
        }
        const data = await res.json();
        const newTokens: TokenPair = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
        };
        await saveTokens(newTokens);
        return newTokens;
    } catch {
        return null;
    }
}

export async function apiFetch(
    path: string,
    options: RequestInit = {},
): Promise<Response> {
    const tokens = await loadTokens();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (tokens?.accessToken) {
        headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

    // Auto-refresh on 401
    if (res.status === 401 && tokens?.refreshToken) {
        if (!refreshPromise) {
            refreshPromise = refreshAccessToken();
        }
        const newTokens = await refreshPromise;
        refreshPromise = null;

        if (newTokens) {
            headers.Authorization = `Bearer ${newTokens.accessToken}`;
            res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
        }
    }

    return res;
}

export { BASE_URL };
export type { TokenPair };
