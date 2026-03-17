package domain

import "time"

type User struct {
	ID            int64     `json:"id"`
	Email         *string   `json:"email,omitempty"`
	Phone         *string   `json:"phone,omitempty"`
	EmailVerified bool      `json:"email_verified"`
	PhoneVerified bool      `json:"phone_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Device struct {
	ID         int64      `json:"id"`
	UserID     int64      `json:"user_id"`
	DeviceUUID string     `json:"device_uuid"`
	Platform   string     `json:"platform"`
	PushToken  *string    `json:"push_token,omitempty"`
	IsActive   bool       `json:"is_active"`
	LastSeenAt *time.Time `json:"last_seen_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// DeviceWithKeys combines device info + its key bundle for fan-out encryption.
type DeviceWithKeys struct {
	DeviceID              int64  `json:"device_id"`
	UserID                int64  `json:"user_id"`
	Platform              string `json:"platform"`
	RegistrationID        int    `json:"registration_id"`
	IdentityPublicKey     string `json:"identity_public_key"`
	IdentityKeyVersion    int    `json:"identity_key_version"`
	SignedPreKeyID        int64  `json:"signed_prekey_id"`
	SignedPreKeyPublic    string `json:"signed_prekey_public"`
	SignedPreKeySignature string `json:"signed_prekey_signature"`
	OneTimePreKeyID       *int64 `json:"one_time_prekey_id,omitempty"`
	OneTimePreKeyPublic   *string `json:"one_time_prekey_public,omitempty"`
}

// MessageRecipient stores per-device ciphertext for fan-out messages.
type MessageRecipient struct {
	ID               int64      `json:"id"`
	MessageID        int64      `json:"message_id"`
	ReceiverDeviceID int64      `json:"receiver_device_id"`
	Ciphertext       []byte     `json:"ciphertext"`
	HeaderJSON       string     `json:"header_json"`
	Status           string     `json:"status"`
	DeliveredAt      *time.Time `json:"delivered_at,omitempty"`
	ReadAt           *time.Time `json:"read_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}

type DeviceKey struct {
	DeviceID            int64     `json:"device_id"`
	RegistrationID      int       `json:"registration_id"`
	IdentityPublicKey   string    `json:"identity_public_key"`
	IdentityKeyVersion  int       `json:"identity_key_version"`
	SignedPreKeyID      int64     `json:"signed_prekey_id"`
	SignedPreKeyPublic  string    `json:"signed_prekey_public"`
	SignedPreKeySig     string    `json:"signed_prekey_signature"`
	SignedPreKeyCreated time.Time `json:"signed_prekey_created_at"`
	SignedPreKeyExpires time.Time `json:"signed_prekey_expires_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type OneTimePreKey struct {
	ID         int64      `json:"id"`
	DeviceID   int64      `json:"device_id"`
	PreKeyID   int64      `json:"prekey_id"`
	PreKeyPub  string     `json:"prekey_public"`
	Status     string     `json:"status"`
	ReservedAt *time.Time `json:"reserved_at,omitempty"`
	UsedAt     *time.Time `json:"used_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type Conversation struct {
	ID        int64     `json:"id"`
	User1ID   int64     `json:"user1_id"`
	User2ID   int64     `json:"user2_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Message struct {
	ID               int64      `json:"id"`
	ConversationID   int64      `json:"conversation_id"`
	SenderID         int64      `json:"sender_id"`
	SenderDeviceID   int64      `json:"sender_device_id"`
	ReceiverID       int64      `json:"receiver_id"`
	ClientMessageID  string     `json:"client_message_id"`
	Ciphertext       []byte     `json:"ciphertext"`
	HeaderJSON       string     `json:"header_json"`
	ServerReceivedAt time.Time  `json:"server_received_at"`
	DeliveredAt      *time.Time `json:"delivered_at,omitempty"`
	ReadAt           *time.Time `json:"read_at,omitempty"`
	ExpiresAt        time.Time  `json:"expires_at"`
}

type RefreshTokenRecord struct {
	ID         int64      `json:"id"`
	UserID     int64      `json:"user_id"`
	DeviceID   int64      `json:"device_id"`
	TokenHash  string     `json:"token_hash"`
	FamilyID   string     `json:"family_id"`
	SessionID  string     `json:"session_id"`
	IssuedAt   time.Time  `json:"issued_at"`
	ExpiresAt  time.Time  `json:"expires_at"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
	ReplacedBy *int64     `json:"replaced_by,omitempty"`
}

type MessageHeader struct {
	MessageType             string `json:"message_type"`
	SessionVersion          int    `json:"session_version"`
	SenderIdentityPubB64    string `json:"sender_identity_pub_b64"`
	SenderEphemeralPubB64   string `json:"sender_ephemeral_pub_b64"`
	ReceiverOneTimePreKeyID int64  `json:"receiver_one_time_prekey_id"`
	RatchetPubB64           string `json:"ratchet_pub_b64"`
	MessageIndex            int    `json:"message_index"`
}
