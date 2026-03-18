/** A single device's key bundle (server-shaped, used for local mocks). */
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

/** Minimal device info (server-shaped, used for local mocks). */
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
export interface Message {
    id: number;
    conversation_id: number;
    sender_id: number;
    sender_device_id?: number;
    receiver_id: number;
    client_message_id: string;
    ciphertext_b64: string;
    header: Record<string, any>;
    created_at: string;
    delivered_at?: string;
    read_at?: string;
}

export interface ConversationItem {
    conversation_id: number;
    peer_user_id: number;
    peer_email?: string;
    peer_phone?: string;
    last_message_id?: number;
    last_message_at?: string;
    unread_count: number;
}