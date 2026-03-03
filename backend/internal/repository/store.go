package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"securemsg/backend/internal/domain"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

type KeyBundle struct {
	UserID                int64  `json:"user_id"`
	DeviceID              int64  `json:"device_id"`
	RegistrationID        int    `json:"registration_id"`
	IdentityPublicKey     string `json:"identity_public_key"`
	IdentityKeyVersion    int    `json:"identity_key_version"`
	SignedPreKeyID        int64  `json:"signed_prekey_id"`
	SignedPreKeyPublic    string `json:"signed_prekey_public"`
	SignedPreKeySignature string `json:"signed_prekey_signature"`
	OneTimePreKeyID       int64  `json:"one_time_prekey_id"`
	OneTimePreKeyPublic   string `json:"one_time_prekey_public"`
}

type ConversationItem struct {
	ConversationID int64      `json:"conversation_id"`
	PeerUserID     int64      `json:"peer_user_id"`
	LastMessageID  *int64     `json:"last_message_id,omitempty"`
	LastMessageAt  *time.Time `json:"last_message_at,omitempty"`
	UnreadCount    int64      `json:"unread_count"`
}

type RefreshLookup struct {
	Record  domain.RefreshTokenRecord
	IsReuse bool
}

func (s *Store) CreateOrGetUserByIdentifier(ctx context.Context, identifierType, identifier string, now time.Time) (*domain.User, error) {
	column := "email"
	verifiedCol := "email_verified"
	if identifierType == "phone" {
		column = "phone"
		verifiedCol = "phone_verified"
	}

	query := fmt.Sprintf("SELECT id, email, phone, email_verified, phone_verified, created_at, updated_at FROM users WHERE %s = ? LIMIT 1", column)
	user := &domain.User{}
	err := s.db.QueryRowContext(ctx, query, identifier).Scan(
		&user.ID, &user.Email, &user.Phone, &user.EmailVerified, &user.PhoneVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	insertQuery := fmt.Sprintf("INSERT INTO users (%s, %s, created_at, updated_at) VALUES (?, TRUE, ?, ?)", column, verifiedCol)
	res, err := s.db.ExecContext(ctx, insertQuery, identifier, now, now)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return s.CreateOrGetUserByIdentifier(ctx, identifierType, identifier, now)
		}
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	if identifierType == "email" {
		user.Email = &identifier
		user.EmailVerified = true
	} else {
		user.Phone = &identifier
		user.PhoneVerified = true
	}
	user.ID = id
	user.CreatedAt = now
	user.UpdatedAt = now
	return user, nil
}

func (s *Store) LookupUserByIdentifier(ctx context.Context, identifierType, identifier string) (*domain.User, error) {
	column := "email"
	if identifierType == "phone" {
		column = "phone"
	}
	query := fmt.Sprintf("SELECT id, email, phone, email_verified, phone_verified, created_at, updated_at FROM users WHERE %s = ? LIMIT 1", column)
	user := &domain.User{}
	err := s.db.QueryRowContext(ctx, query, identifier).Scan(
		&user.ID, &user.Email, &user.Phone, &user.EmailVerified, &user.PhoneVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Store) GetUserByID(ctx context.Context, userID int64) (*domain.User, error) {
	user := &domain.User{}
	err := s.db.QueryRowContext(ctx,
		"SELECT id, email, phone, email_verified, phone_verified, created_at, updated_at FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Email, &user.Phone, &user.EmailVerified, &user.PhoneVerified, &user.CreatedAt, &user.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Store) UpsertDevice(ctx context.Context, userID int64, deviceUUID, platform string, pushToken *string, now time.Time) (*domain.Device, error) {
	if platform == "" {
		platform = "unknown"
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO devices (user_id, device_uuid, platform, push_token, last_seen_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
		platform = VALUES(platform),
		push_token = VALUES(push_token),
		last_seen_at = VALUES(last_seen_at),
		updated_at = VALUES(updated_at)
	`, userID, deviceUUID, platform, pushToken, now, now, now)
	if err != nil {
		return nil, err
	}
	device := &domain.Device{}
	err = s.db.QueryRowContext(ctx, `
		SELECT id, user_id, device_uuid, platform, push_token, last_seen_at, created_at, updated_at
		FROM devices WHERE user_id = ? AND device_uuid = ? LIMIT 1
	`, userID, deviceUUID).Scan(
		&device.ID, &device.UserID, &device.DeviceUUID, &device.Platform, &device.PushToken, &device.LastSeenAt, &device.CreatedAt, &device.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return device, nil
}

func (s *Store) TouchDeviceSeen(ctx context.Context, deviceID int64, now time.Time) error {
	_, err := s.db.ExecContext(ctx, "UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE id = ?", now, now, deviceID)
	return err
}

func (s *Store) GetLatestDeviceByUser(ctx context.Context, userID int64) (*domain.Device, error) {
	device := &domain.Device{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, device_uuid, platform, push_token, last_seen_at, created_at, updated_at
		FROM devices
		WHERE user_id = ?
		ORDER BY updated_at DESC
		LIMIT 1
	`, userID).Scan(
		&device.ID, &device.UserID, &device.DeviceUUID, &device.Platform, &device.PushToken, &device.LastSeenAt, &device.CreatedAt, &device.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return device, nil
}

func (s *Store) StoreRefreshToken(ctx context.Context, rec domain.RefreshTokenRecord) (int64, error) {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO refresh_tokens (user_id, device_id, token_hash, family_id, session_id, issued_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, rec.UserID, rec.DeviceID, rec.TokenHash, rec.FamilyID, rec.SessionID, rec.IssuedAt, rec.ExpiresAt)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) FindRefreshTokenByHash(ctx context.Context, tokenHash string) (*RefreshLookup, error) {
	rec := domain.RefreshTokenRecord{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, device_id, token_hash, family_id, session_id, issued_at, expires_at, revoked_at, replaced_by
		FROM refresh_tokens
		WHERE token_hash = ?
		LIMIT 1
	`, tokenHash).Scan(
		&rec.ID, &rec.UserID, &rec.DeviceID, &rec.TokenHash, &rec.FamilyID, &rec.SessionID,
		&rec.IssuedAt, &rec.ExpiresAt, &rec.RevokedAt, &rec.ReplacedBy,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	lookup := &RefreshLookup{Record: rec}
	if rec.RevokedAt != nil {
		lookup.IsReuse = true
	}
	return lookup, nil
}

func (s *Store) RotateRefreshToken(ctx context.Context, oldID int64, next domain.RefreshTokenRecord) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO refresh_tokens (user_id, device_id, token_hash, family_id, session_id, issued_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, next.UserID, next.DeviceID, next.TokenHash, next.FamilyID, next.SessionID, next.IssuedAt, next.ExpiresAt)
	if err != nil {
		return 0, err
	}
	newID, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	now := time.Now().UTC()
	if _, err := tx.ExecContext(ctx, "UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE id = ?", now, newID, oldID); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return newID, nil
}

func (s *Store) RevokeRefreshFamily(ctx context.Context, familyID string) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE family_id = ?", now, familyID)
	return err
}

func (s *Store) RevokeRefreshSession(ctx context.Context, sessionID string) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE session_id = ?", now, sessionID)
	return err
}

func (s *Store) IsSessionActive(ctx context.Context, userID, deviceID int64, sessionID string, now time.Time) (bool, error) {
	var marker int
	err := s.db.QueryRowContext(ctx, `
		SELECT 1
		FROM refresh_tokens
		WHERE user_id = ? AND device_id = ? AND session_id = ? AND revoked_at IS NULL AND expires_at > ?
		LIMIT 1
	`, userID, deviceID, sessionID, now).Scan(&marker)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) UpsertDeviceKeys(ctx context.Context, key domain.DeviceKey, prekeys []domain.OneTimePreKey, now time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO device_keys (
			device_id, registration_id, identity_public_key, identity_key_version, signed_prekey_id,
			signed_prekey_public, signed_prekey_signature, signed_prekey_created_at,
			signed_prekey_expires_at, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			registration_id = VALUES(registration_id),
			identity_public_key = VALUES(identity_public_key),
			identity_key_version = VALUES(identity_key_version),
			signed_prekey_id = VALUES(signed_prekey_id),
			signed_prekey_public = VALUES(signed_prekey_public),
			signed_prekey_signature = VALUES(signed_prekey_signature),
			signed_prekey_created_at = VALUES(signed_prekey_created_at),
			signed_prekey_expires_at = VALUES(signed_prekey_expires_at),
			updated_at = VALUES(updated_at)
	`, key.DeviceID, key.RegistrationID, key.IdentityPublicKey, key.IdentityKeyVersion, key.SignedPreKeyID,
		key.SignedPreKeyPublic, key.SignedPreKeySig, key.SignedPreKeyCreated, key.SignedPreKeyExpires, now)
	if err != nil {
		return err
	}

	for _, p := range prekeys {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO one_time_prekeys (device_id, prekey_id, prekey_public, status, created_at)
			VALUES (?, ?, ?, 'available', ?)
			ON DUPLICATE KEY UPDATE prekey_public = VALUES(prekey_public), status = IF(status='used', status, 'available')
		`, p.DeviceID, p.PreKeyID, p.PreKeyPub, now)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) RotateSignedPreKey(ctx context.Context, deviceID int64, signedPrekeyID int64, signedPreKeyPublic, signature string, expiresAt, now time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE device_keys
		SET signed_prekey_id = ?, signed_prekey_public = ?, signed_prekey_signature = ?,
			signed_prekey_created_at = ?, signed_prekey_expires_at = ?, updated_at = ?
		WHERE device_id = ?
	`, signedPrekeyID, signedPreKeyPublic, signature, now, expiresAt, now, deviceID)
	return err
}

func (s *Store) AddOneTimePrekeys(ctx context.Context, deviceID int64, prekeys []domain.OneTimePreKey, now time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, p := range prekeys {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO one_time_prekeys (device_id, prekey_id, prekey_public, status, created_at)
			VALUES (?, ?, ?, 'available', ?)
			ON DUPLICATE KEY UPDATE prekey_public = VALUES(prekey_public), status = IF(status='used', status, 'available')
		`, deviceID, p.PreKeyID, p.PreKeyPub, now)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) CountAvailablePreKeys(ctx context.Context, deviceID int64) (int64, error) {
	var count int64
	err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM one_time_prekeys WHERE device_id = ? AND status = 'available'", deviceID).Scan(&count)
	return count, err
}

func (s *Store) GetDeviceKey(ctx context.Context, deviceID int64) (*domain.DeviceKey, error) {
	key := &domain.DeviceKey{}
	err := s.db.QueryRowContext(ctx, `
		SELECT device_id, registration_id, identity_public_key, identity_key_version, signed_prekey_id, signed_prekey_public,
		       signed_prekey_signature, signed_prekey_created_at, signed_prekey_expires_at, updated_at
		FROM device_keys
		WHERE device_id = ?
	`, deviceID).Scan(
		&key.DeviceID,
		&key.RegistrationID,
		&key.IdentityPublicKey,
		&key.IdentityKeyVersion,
		&key.SignedPreKeyID,
		&key.SignedPreKeyPublic,
		&key.SignedPreKeySig,
		&key.SignedPreKeyCreated,
		&key.SignedPreKeyExpires,
		&key.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return key, nil
}

func (s *Store) GetUserIDByDeviceID(ctx context.Context, deviceID int64) (int64, error) {
	var userID int64
	err := s.db.QueryRowContext(ctx, "SELECT user_id FROM devices WHERE id = ?", deviceID).Scan(&userID)
	if err != nil {
		return 0, err
	}
	return userID, nil
}

func (s *Store) ListConversationPeerUserIDs(ctx context.Context, userID int64) ([]int64, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END AS peer_user_id
		FROM conversations
		WHERE user1_id = ? OR user2_id = ?
	`, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	peers := make([]int64, 0)
	for rows.Next() {
		var peerUserID int64
		if err := rows.Scan(&peerUserID); err != nil {
			return nil, err
		}
		peers = append(peers, peerUserID)
	}
	return peers, rows.Err()
}

func (s *Store) ReserveKeyBundle(ctx context.Context, targetUserID int64, now time.Time) (*KeyBundle, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var deviceID int64
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM devices WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1
	`, targetUserID).Scan(&deviceID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	bundle := &KeyBundle{UserID: targetUserID, DeviceID: deviceID}
	err = tx.QueryRowContext(ctx, `
		SELECT registration_id, identity_public_key, identity_key_version, signed_prekey_id, signed_prekey_public, signed_prekey_signature
		FROM device_keys WHERE device_id = ?
	`, deviceID).Scan(&bundle.RegistrationID, &bundle.IdentityPublicKey, &bundle.IdentityKeyVersion, &bundle.SignedPreKeyID, &bundle.SignedPreKeyPublic, &bundle.SignedPreKeySignature)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var preKeyRowID int64
	err = tx.QueryRowContext(ctx, `
		SELECT id, prekey_id, prekey_public
		FROM one_time_prekeys
		WHERE device_id = ? AND status = 'available'
		ORDER BY id
		LIMIT 1
		FOR UPDATE
	`, deviceID).Scan(&preKeyRowID, &bundle.OneTimePreKeyID, &bundle.OneTimePreKeyPublic)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("no one-time prekeys available")
	}
	if err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, "UPDATE one_time_prekeys SET status = 'reserved', reserved_at = ? WHERE id = ?", now, preKeyRowID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return bundle, nil
}

func (s *Store) MarkOneTimePreKeyUsed(ctx context.Context, receiverUserID, prekeyID int64, now time.Time) error {
	var deviceID int64
	err := s.db.QueryRowContext(ctx, "SELECT id FROM devices WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1", receiverUserID).Scan(&deviceID)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		UPDATE one_time_prekeys
		SET status = 'used', used_at = ?
		WHERE device_id = ? AND prekey_id = ? AND status IN ('reserved','available')
	`, now, deviceID, prekeyID)
	return err
}

func (s *Store) GetOrCreateConversation(ctx context.Context, a, b int64, now time.Time) (int64, error) {
	pair := userPairKey(a, b)
	var id int64
	err := s.db.QueryRowContext(ctx, "SELECT id FROM conversations WHERE user_pair_key = ?", pair).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}

	u := []int64{a, b}
	sort.Slice(u, func(i, j int) bool { return u[i] < u[j] })
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO conversations (user1_id, user2_id, created_at, user_pair_key)
		VALUES (?, ?, ?, ?)
	`, u[0], u[1], now, pair)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return s.GetOrCreateConversation(ctx, a, b, now)
		}
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) InsertMessageIdempotent(ctx context.Context, msg *domain.Message) (*domain.Message, bool, error) {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO messages (conversation_id, sender_id, receiver_id, client_message_id, ciphertext, header_json, server_received_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, msg.ConversationID, msg.SenderID, msg.ReceiverID, msg.ClientMessageID, msg.Ciphertext, msg.HeaderJSON, msg.ServerReceivedAt, msg.ExpiresAt)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			existing, getErr := s.GetMessageBySenderClientID(ctx, msg.SenderID, msg.ClientMessageID)
			if getErr != nil {
				return nil, false, getErr
			}
			return existing, true, nil
		}
		return nil, false, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, false, err
	}
	msg.ID = id
	return msg, false, nil
}

func (s *Store) GetMessageBySenderClientID(ctx context.Context, senderID int64, clientMessageID string) (*domain.Message, error) {
	var msg domain.Message
	err := s.db.QueryRowContext(ctx, `
		SELECT id, conversation_id, sender_id, receiver_id, client_message_id, ciphertext, header_json, server_received_at, delivered_at, read_at, expires_at
		FROM messages
		WHERE sender_id = ? AND client_message_id = ?
	`, senderID, clientMessageID).Scan(
		&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.ReceiverID, &msg.ClientMessageID,
		&msg.Ciphertext, &msg.HeaderJSON, &msg.ServerReceivedAt, &msg.DeliveredAt, &msg.ReadAt, &msg.ExpiresAt,
	)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (s *Store) MarkDeliveredByReceiver(ctx context.Context, messageID int64, receiverID int64, now time.Time) (*domain.Message, error) {
	res, err := s.db.ExecContext(ctx, `
		UPDATE messages
		SET delivered_at = COALESCE(delivered_at, ?)
		WHERE id = ? AND receiver_id = ?
	`, now, messageID, receiverID)
	if err != nil {
		return nil, err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rowsAffected == 0 {
		return nil, nil
	}
	return s.GetMessageByID(ctx, messageID)
}

func (s *Store) MarkRead(ctx context.Context, messageID int64, readerID int64, now time.Time) (*domain.Message, error) {
	res, err := s.db.ExecContext(ctx, `
		UPDATE messages
		SET read_at = COALESCE(read_at, ?), delivered_at = COALESCE(delivered_at, ?)
		WHERE id = ? AND receiver_id = ?
	`, now, now, messageID, readerID)
	if err != nil {
		return nil, err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rowsAffected == 0 {
		return nil, nil
	}
	return s.GetMessageByID(ctx, messageID)
}

func (s *Store) GetMessageByID(ctx context.Context, messageID int64) (*domain.Message, error) {
	row := &domain.Message{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, conversation_id, sender_id, receiver_id, client_message_id, ciphertext, header_json, server_received_at, delivered_at, read_at, expires_at
		FROM messages WHERE id = ?
	`, messageID).Scan(
		&row.ID, &row.ConversationID, &row.SenderID, &row.ReceiverID, &row.ClientMessageID,
		&row.Ciphertext, &row.HeaderJSON, &row.ServerReceivedAt, &row.DeliveredAt, &row.ReadAt, &row.ExpiresAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return row, nil
}

func (s *Store) ListConversations(ctx context.Context, userID int64, limit int) ([]ConversationItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT
		  c.id,
		  CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END AS peer_user_id,
		  m.id AS last_message_id,
		  m.server_received_at AS last_message_at,
		  (
			SELECT COUNT(*) FROM messages um
			WHERE um.conversation_id = c.id AND um.receiver_id = ? AND um.read_at IS NULL
		  ) AS unread_count
		FROM conversations c
		LEFT JOIN messages m ON m.id = (
			SELECT m2.id FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.id DESC LIMIT 1
		)
		WHERE c.user1_id = ? OR c.user2_id = ?
		ORDER BY COALESCE(m.server_received_at, c.created_at) DESC
		LIMIT ?
	`, userID, userID, userID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]ConversationItem, 0)
	for rows.Next() {
		var item ConversationItem
		var lastMessageID sql.NullInt64
		var lastMessageAt sql.NullTime
		if err := rows.Scan(&item.ConversationID, &item.PeerUserID, &lastMessageID, &lastMessageAt, &item.UnreadCount); err != nil {
			return nil, err
		}
		if lastMessageID.Valid {
			item.LastMessageID = &lastMessageID.Int64
		}
		if lastMessageAt.Valid {
			t := lastMessageAt.Time
			item.LastMessageAt = &t
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *Store) SyncMessages(ctx context.Context, receiverID int64, since time.Time, limit int) ([]domain.Message, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, conversation_id, sender_id, receiver_id, client_message_id, ciphertext, header_json, server_received_at, delivered_at, read_at, expires_at
		FROM messages
		WHERE receiver_id = ? AND server_received_at > ?
		ORDER BY server_received_at ASC
		LIMIT ?
	`, receiverID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]domain.Message, 0)
	for rows.Next() {
		var msg domain.Message
		if err := rows.Scan(
			&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.ReceiverID, &msg.ClientMessageID,
			&msg.Ciphertext, &msg.HeaderJSON, &msg.ServerReceivedAt, &msg.DeliveredAt, &msg.ReadAt, &msg.ExpiresAt,
		); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}
	return messages, rows.Err()
}

func (s *Store) DeleteExpiredMessages(ctx context.Context, now time.Time) (int64, error) {
	res, err := s.db.ExecContext(ctx, "DELETE FROM messages WHERE expires_at <= ?", now)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (s *Store) SaveAuditEvent(ctx context.Context, userID *int64, deviceID *int64, eventType string, metadata any, now time.Time) error {
	metaJSON, _ := json.Marshal(metadata)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO audit_events (user_id, device_id, event_type, metadata_json, created_at)
		VALUES (?, ?, ?, ?, ?)
	`, userID, deviceID, eventType, string(metaJSON), now)
	return err
}

func userPairKey(a, b int64) string {
	if a < b {
		return fmt.Sprintf("%d:%d", a, b)
	}
	return fmt.Sprintf("%d:%d", b, a)
}
