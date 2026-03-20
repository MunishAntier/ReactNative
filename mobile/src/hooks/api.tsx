/**
 * API Hook
 *
 * Handles all HTTP requests for the app.
 * Session tokens (access_token, refresh_token, user) are stored securely
 * in the OS Keychain (iOS) / Keystore (Android) via react-native-keychain.
 */
import * as Keychain from 'react-native-keychain';
import { Alert } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
}

export type RequestCredentials = 'omit' | 'same-origin' | 'include';

export interface RequestConfig {
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  responseType?: 'json' | 'blob';
}

// ─── Constants ────────────────────────────────────────────────────────────────

import type { SetOptions } from 'react-native-keychain';


const SESSION_SERVICE = 'securemsg_session';

const KEYCHAIN_OPTIONS: SetOptions = {
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  service: SESSION_SERVICE,
};

// ─── Secure Session Storage ───────────────────────────────────────────────────

/**
 * Saves a session value securely in the OS Keychain / Keystore.
 * @param key   Identifier (e.g. 'access_token')
 * @param value Value to store
 */
export const saveSessionItem = async (key: string, value: string): Promise<void> => {
  console.log(`[Keychain] Saving ${key}...`);
  try {
    const result = await Keychain.setGenericPassword(key, value, {
      ...KEYCHAIN_OPTIONS,
      service: `${SESSION_SERVICE}_${key}`,
    });
    console.log(`[Keychain] Save result for ${key}: ${!!result}`);
  } catch (e) {
    console.warn(`[Keychain] Failed to save ${key}:`, e);
  }
};

/**
 * Reads a session value from the OS Keychain / Keystore.
 * Returns null if not found.
 */
export const getSessionItem = async (key: string): Promise<string | null> => {
  try {
    const result = await Keychain.getGenericPassword({
      service: `${SESSION_SERVICE}_${key}`,
    });
    if (result && typeof result === 'object' && 'password' in result) {
      return result.password;
    }
  } catch (e) {
    console.warn(`[Keychain] Failed to read ${key}:`, e);
  }
  return null;
};

/**
 * Removes all session tokens from the Keychain / Keystore on logout.
 */
export const removeSession = async (): Promise<void> => {
  const keys = ['access_token', 'refresh_token', 'user'];
  await Promise.all(
    keys.map(key =>
      Keychain.resetGenericPassword({
        service: `${SESSION_SERVICE}_${key}`,
      }).catch(e => console.warn(`[API] Failed to remove ${key} from Keychain:`, e)),
    ),
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const notifyError = (title: string, message: string): void => {
  Alert.alert(title, message);
};

const messagesMap: Record<string, string> = {
  // Add user-facing message overrides here as needed
};

// ─── Core Request ─────────────────────────────────────────────────────────────

const makeRequest = async (
  options: RequestOptions,
  config: RequestConfig = {},
  baseUrl?: string,
) => {
  const isExternal = options.url.startsWith('http');
  const defaultConfig: RequestConfig = isExternal
    ? { headers: {}, credentials: config.credentials || 'omit' }
    : {
      headers: {
        'Content-Type': 'application/json',
      } as Record<string, string>,
      credentials: 'include',
    };

  // Remove Content-Type for binary bodies so multipart boundary is auto-set
  if (
    options.body instanceof FormData ||
    options.body instanceof Blob
  ) {
    if (defaultConfig.headers) {
      delete defaultConfig.headers['Content-Type'];
    }
  }

  const mergedConfig = {
    ...defaultConfig,
    ...config,
    headers: {
      ...defaultConfig.headers,
      ...config.headers,
    },
  };

  // Attach access token from Keychain if available
  const accessToken = await getSessionItem('access_token');
  console.log(`[API] accessToken found: ${accessToken ? 'YES (starts with ' + accessToken.substring(0, 10) + '...)' : 'NO'}`);

  if (accessToken && mergedConfig.headers) {
    mergedConfig.headers['Authorization'] = `Bearer ${accessToken}`;
    console.log('[API] Authorization header attached');
  } else {
    console.log('[API] No Authorization header attached');
  }

  const apiBaseUrl = process.env.API_BASE_URL || 'https://api-chat.devnet.invest.net/api/v1/signal';
  const fullUrl = options.url.startsWith('http')
    ? options.url
    : `${apiBaseUrl}${options.url}`;

  console.log(`[API] Request: ${options.method} ${fullUrl}`);

  const response = await fetch(fullUrl, {
    method: options.method,
    headers: mergedConfig.headers,
    credentials: mergedConfig.credentials,
    body:
      options.body instanceof FormData || options.body instanceof Blob
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `Request failed with status ${response.status}` };
    }

    const errors = errorData?.errors || [];
    const message = errorData?.message || '';

    if (message === 'authz.invalid_session' || errors.includes('authz.invalid_session')) {
      console.log('[API] Invalid session detected, wiping session...');
      notifyError('Error', 'Session has expired.');
      await removeSession();
    } else if (
      !Array.isArray(errorData?.message) &&
      errorData?.message?.startsWith('authz.restrict')
    ) {
      notifyError('Error', 'Access denied.');
    } else if (errorData?.message === 'authz.invalid_permission') {
      notifyError('Error', 'Permission denied.');
    }

    throw errorData;
  }

  if (config.responseType === 'blob') {
    return response;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return { success: true, status: response.status };
  }

  // ── Persist auth tokens from response headers ──
  const newAccessToken = response.headers.get('x-access-token');
  const newRefreshToken = response.headers.get('x-refresh-token');

  if (newAccessToken) {
    console.log('accessToken ', newAccessToken);
    await saveSessionItem('access_token', newAccessToken);
  }
  if (newRefreshToken) {
    console.log('refreshToken', newRefreshToken);
    await saveSessionItem('refresh_token', newRefreshToken);
  }

  const data = await response.json();
  data.message = messagesMap[data.message] || data.message;
  return data;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const API = {
  get: (config?: RequestConfig, baseUrl?: string) => async (url: string) =>
    makeRequest({ method: 'GET', url }, config, baseUrl),

  post:
    (config?: RequestConfig, baseUrl?: string) =>
      async (url: string, body: any) =>
        makeRequest({ method: 'POST', body, url }, config, baseUrl),

  put:
    (config?: RequestConfig, baseUrl?: string) =>
      async (url: string, body: any) =>
        makeRequest({ method: 'PUT', body, url }, config, baseUrl),

  delete:
    (config?: RequestConfig, baseUrl?: string) =>
      async (url: string, body: any) =>
        makeRequest({ method: 'DELETE', body, url }, config, baseUrl),

  patch:
    (config?: RequestConfig, baseUrl?: string) =>
      async (url: string, body: any) =>
        makeRequest({ method: 'PATCH', body, url }, config, baseUrl),
};