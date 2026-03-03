CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  device_uuid VARCHAR(128) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  push_token TEXT,
  last_seen_at DATETIME,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_user_device (user_id, device_uuid),
  CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS device_keys (
  device_id BIGINT PRIMARY KEY,
  registration_id INT NOT NULL DEFAULT 1,
  identity_public_key TEXT NOT NULL,
  identity_key_version INT NOT NULL DEFAULT 1,
  signed_prekey_id BIGINT NOT NULL,
  signed_prekey_public TEXT NOT NULL,
  signed_prekey_signature TEXT NOT NULL,
  signed_prekey_created_at DATETIME NOT NULL,
  signed_prekey_expires_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_device_keys_device FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS one_time_prekeys (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  device_id BIGINT NOT NULL,
  prekey_id BIGINT NOT NULL,
  prekey_public TEXT NOT NULL,
  status ENUM('available','reserved','used') NOT NULL DEFAULT 'available',
  reserved_at DATETIME,
  used_at DATETIME,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uniq_device_prekey (device_id, prekey_id),
  KEY idx_prekeys_device_status (device_id, status),
  CONSTRAINT fk_prekeys_device FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user1_id BIGINT NOT NULL,
  user2_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  user_pair_key VARCHAR(64) NOT NULL,
  UNIQUE KEY uniq_user_pair (user_pair_key),
  CONSTRAINT fk_conversation_user1 FOREIGN KEY (user1_id) REFERENCES users(id),
  CONSTRAINT fk_conversation_user2 FOREIGN KEY (user2_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  sender_id BIGINT NOT NULL,
  receiver_id BIGINT NOT NULL,
  client_message_id VARCHAR(64) NOT NULL,
  ciphertext BLOB NOT NULL,
  header_json JSON NOT NULL,
  server_received_at DATETIME NOT NULL,
  delivered_at DATETIME,
  read_at DATETIME,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uniq_sender_client_msg (sender_id, client_message_id),
  KEY idx_messages_receiver_received (receiver_id, server_received_at),
  CONSTRAINT fk_messages_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  device_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  family_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  issued_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  replaced_by BIGINT,
  UNIQUE KEY uniq_token_hash (token_hash),
  KEY idx_refresh_family (family_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_refresh_device FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  identifier_hash CHAR(64) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  KEY idx_otp_identifier (identifier_hash)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  device_id BIGINT,
  event_type VARCHAR(128) NOT NULL,
  metadata_json JSON,
  created_at DATETIME NOT NULL,
  KEY idx_audit_user (user_id),
  KEY idx_audit_type (event_type)
);
