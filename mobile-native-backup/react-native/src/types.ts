export interface AuthStartResponse {
  identifier: string;
  purpose: string;
  otp_ttl_seconds: number;
  dev_otp?: string;
}

export interface AuthTokens {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  userId: number;
  deviceId: number;
  sessionId: string;
}

export interface PreKeyPublic {
  prekey_id: number;
  prekey_public: string;
}

export interface KeyBundleUpload {
  registration_id: number;
  identity_public_key: string;
  identity_key_version: number;
  signed_prekey_id: number;
  signed_prekey_public: string;
  signed_prekey_signature: string;
  signed_prekey_expires_at: string;
  one_time_prekeys: PreKeyPublic[];
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

export interface EncryptedMessage {
  ciphertextB64: string;
  header: {
    session_version: number;
    sender_identity_pub_b64: string;
    sender_ephemeral_pub_b64: string;
    receiver_one_time_prekey_id: number;
    ratchet_pub_b64: string;
    message_index: number;
  };
}

export interface SyncMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  receiver_id: number;
  client_message_id: string;
  ciphertext_b64: string;
  header: Record<string, unknown>;
  created_at: string;
  delivered_at?: string;
  read_at?: string;
}

export interface StoredCiphertextMessage {
  id: number;
  conversationId: number;
  senderId: number;
  receiverId: number;
  ciphertextB64: string;
  headerJSON: string;
  createdAt: string;
}
