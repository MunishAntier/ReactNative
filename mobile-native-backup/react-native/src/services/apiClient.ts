import type {
  AuthStartResponse,
  AuthTokens,
  KeyBundleUpload,
  PeerKeyBundle,
  PreKeyPublic,
  SyncMessage
} from '../types';

interface SyncResponse {
  items: SyncMessage[];
}

interface VerifyResponse {
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
  user_id: number;
  device_id: number;
  session_id: string;
}

export class APIClient {
  constructor(private readonly baseURL: string) {}

  async startAuth(identifier: string): Promise<AuthStartResponse> {
    return this.request<AuthStartResponse>('/v1/auth/start', {
      method: 'POST',
      body: {
        identifier,
        purpose: 'login'
      }
    });
  }

  async verifyAuth(identifier: string, otp: string, platform: string): Promise<AuthTokens> {
    const payload = await this.request<VerifyResponse>('/v1/auth/verify', {
      method: 'POST',
      body: {
        identifier,
        otp,
        device_uuid: `${platform}-${Date.now().toString(36)}`,
        platform,
        push_token: null
      }
    });

    return {
      accessToken: payload.access_token,
      accessExpiresAt: payload.access_expires_at,
      refreshToken: payload.refresh_token,
      refreshExpiresAt: payload.refresh_expires_at,
      userId: payload.user_id,
      deviceId: payload.device_id,
      sessionId: payload.session_id
    };
  }

  async logout(accessToken: string): Promise<void> {
    await this.request<void>('/v1/auth/logout', {
      method: 'POST',
      accessToken
    });
  }

  async uploadInitialKeys(accessToken: string, bundle: KeyBundleUpload): Promise<void> {
    await this.request<void>('/v1/keys/upload', {
      method: 'POST',
      accessToken,
      body: bundle
    });
  }

  async uploadOneTimePreKeys(accessToken: string, oneTimePreKeys: PreKeyPublic[]): Promise<void> {
    await this.request<void>('/v1/keys/one-time-prekeys/upload', {
      method: 'POST',
      accessToken,
      body: {
        one_time_prekeys: oneTimePreKeys
      }
    });
  }

  async fetchPeerBundle(accessToken: string, userID: number): Promise<PeerKeyBundle> {
    return this.request<PeerKeyBundle>(`/v1/keys/${userID}`, {
      method: 'GET',
      accessToken
    });
  }

  async syncMessages(accessToken: string, sinceRFC3339: string, limit = 100): Promise<SyncMessage[]> {
    const query = encodeURIComponent(sinceRFC3339);
    const response = await this.request<SyncResponse>(`/v1/messages/sync?since=${query}&limit=${limit}`, {
      method: 'GET',
      accessToken
    });
    return response.items ?? [];
  }

  private async request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST';
      accessToken?: string;
      body?: unknown;
    }
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }

    const response = await fetch(`${this.baseURL}${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const raw = await response.text();
    const parsed = raw ? safeJSONParse(raw) : null;

    if (!response.ok) {
      const message = extractError(parsed, raw, response.status);
      throw new Error(message);
    }

    return (parsed ?? (undefined as T)) as T;
  }
}

function safeJSONParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractError(parsed: unknown, raw: string, status: number): string {
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    const value = (parsed as {error?: unknown}).error;
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  if (raw) {
    return `${status}: ${raw}`;
  }
  return `request failed with status ${status}`;
}
