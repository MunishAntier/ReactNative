package repository

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"securemsg/backend/internal/domain"
)

// ─────────────────────── Device Queries ───────────────────────

// CountActiveDevices returns the number of active devices for a user (Rule 9).
func (s *Store) CountActiveDevices(ctx context.Context, userID int64) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM devices WHERE user_id = ? AND is_active = TRUE", userID,
	).Scan(&count)
	return count, err
}

// ListActiveDevicesWithKeys returns all active devices + their key bundles for a user (Rule 1, 20).
// Each device includes identity_key, signed_prekey, and one reserved one-time prekey.
func (s *Store) ListActiveDevicesWithKeys(ctx context.Context, userID int64, now time.Time) ([]domain.DeviceWithKeys, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx, `
		SELECT d.id, d.user_id, d.platform,
		       dk.registration_id, dk.identity_public_key, dk.identity_key_version,
		       dk.signed_prekey_id, dk.signed_prekey_public, dk.signed_prekey_signature
		FROM devices d
		INNER JOIN device_keys dk ON dk.device_id = d.id
		WHERE d.user_id = ? AND d.is_active = TRUE
		ORDER BY d.last_seen_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []domain.DeviceWithKeys
	for rows.Next() {
		var d domain.DeviceWithKeys
		if err := rows.Scan(
			&d.DeviceID, &d.UserID, &d.Platform,
			&d.RegistrationID, &d.IdentityPublicKey, &d.IdentityKeyVersion,
			&d.SignedPreKeyID, &d.SignedPreKeyPublic, &d.SignedPreKeySignature,
		); err != nil {
			return nil, err
		}
		devices = append(devices, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Reserve one one-time prekey per device
	for i, d := range devices {
		var preKeyRowID int64
		var preKeyID int64
		var preKeyPublic string
		err := tx.QueryRowContext(ctx, `
			SELECT id, prekey_id, prekey_public
			FROM one_time_prekeys
			WHERE device_id = ? AND status = 'available'
			ORDER BY id
			LIMIT 1
			FOR UPDATE
		`, d.DeviceID).Scan(&preKeyRowID, &preKeyID, &preKeyPublic)
		if err == nil {
			devices[i].OneTimePreKeyID = &preKeyID
			devices[i].OneTimePreKeyPublic = &preKeyPublic
			_, _ = tx.ExecContext(ctx, "UPDATE one_time_prekeys SET status = 'reserved', reserved_at = ? WHERE id = ?", now, preKeyRowID)
		}
		// If no prekeys available, leave OneTimePreKey fields nil (Rule 6 — still usable)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return devices, nil
}

// DeactivateDevice marks a device inactive and removes its keys (Rule 13).
func (s *Store) DeactivateDevice(ctx context.Context, deviceID int64, now time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, "UPDATE devices SET is_active = FALSE, updated_at = ? WHERE id = ?", now, deviceID)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "DELETE FROM one_time_prekeys WHERE device_id = ?", deviceID)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "DELETE FROM device_keys WHERE device_id = ?", deviceID)
	if err != nil {
		return err
	}
	// Revoke all sessions for this device
	_, err = tx.ExecContext(ctx, "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE device_id = ?", now, deviceID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// GetDeviceByID returns a device if it exists and belongs to the user.
func (s *Store) GetDeviceByID(ctx context.Context, deviceID, userID int64) (*domain.Device, error) {
	device := &domain.Device{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, device_uuid, platform, push_token, is_active, last_seen_at, created_at, updated_at
		FROM devices WHERE id = ? AND user_id = ?
	`, deviceID, userID).Scan(
		&device.ID, &device.UserID, &device.DeviceUUID, &device.Platform, &device.PushToken,
		&device.IsActive, &device.LastSeenAt, &device.CreatedAt, &device.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return device, nil
}

// ListMyActiveDevices returns all active devices for the current user.
func (s *Store) ListMyActiveDevices(ctx context.Context, userID int64) ([]domain.Device, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, device_uuid, platform, push_token, is_active, last_seen_at, created_at, updated_at
		FROM devices
		WHERE user_id = ? AND is_active = TRUE
		ORDER BY last_seen_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var devices []domain.Device
	for rows.Next() {
		var d domain.Device
		if err := rows.Scan(&d.ID, &d.UserID, &d.DeviceUUID, &d.Platform, &d.PushToken,
			&d.IsActive, &d.LastSeenAt, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		devices = append(devices, d)
	}
	return devices, rows.Err()
}

// ─────────────────────── Fan-Out Message Queries ───────────────────────

// FanOutRecipientInput represents a single per-device ciphertext for fan-out.
type FanOutRecipientInput struct {
	ReceiverDeviceID int64
	CiphertextB64    string
	HeaderJSON       string
}

// InsertFanOutMessage inserts one message row + N message_recipient rows atomically (Rule 28).
func (s *Store) InsertFanOutMessage(ctx context.Context, msg *domain.Message, recipients []FanOutRecipientInput) (*domain.Message, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, false, err
	}
	defer tx.Rollback()

	// Insert the parent message (fan_out=true, ciphertext empty since it's per-device)
	res, err := tx.ExecContext(ctx, `
		INSERT INTO messages (conversation_id, sender_id, sender_device_id, receiver_id, client_message_id, ciphertext, header_json, server_received_at, expires_at, fan_out)
		VALUES (?, ?, ?, ?, ?, '', '{}', ?, ?, TRUE)
	`, msg.ConversationID, msg.SenderID, msg.SenderDeviceID, msg.ReceiverID, msg.ClientMessageID, msg.ServerReceivedAt, msg.ExpiresAt)
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
	msgID, err := res.LastInsertId()
	if err != nil {
		return nil, false, err
	}
	msg.ID = msgID

	// Insert per-device ciphertexts
	for _, r := range recipients {
		ciphertext, decErr := base64.StdEncoding.DecodeString(r.CiphertextB64)
		if decErr != nil {
			return nil, false, decErr
		}
		_, err := tx.ExecContext(ctx, `
			INSERT INTO message_recipients (message_id, receiver_device_id, ciphertext, header_json, status, created_at)
			VALUES (?, ?, ?, ?, 'pending', ?)
		`, msgID, r.ReceiverDeviceID, ciphertext, r.HeaderJSON, msg.ServerReceivedAt)
		if err != nil {
			return nil, false, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, false, err
	}
	return msg, false, nil
}

// MarkRecipientDelivered marks a specific device's message as delivered (Rule 24).
func (s *Store) MarkRecipientDelivered(ctx context.Context, messageID, deviceID int64, now time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE message_recipients
		SET status = 'delivered', delivered_at = COALESCE(delivered_at, ?)
		WHERE message_id = ? AND receiver_device_id = ?
	`, now, messageID, deviceID)
	return err
}

// MarkRecipientRead marks a specific device's message as read (Rule 24).
func (s *Store) MarkRecipientRead(ctx context.Context, messageID, deviceID int64, now time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE message_recipients
		SET status = 'read', read_at = COALESCE(read_at, ?), delivered_at = COALESCE(delivered_at, ?)
		WHERE message_id = ? AND receiver_device_id = ?
	`, now, now, messageID, deviceID)
	return err
}

// SyncFanOutMessages returns per-device messages for a specific device since a given time.
func (s *Store) SyncFanOutMessages(ctx context.Context, deviceID int64, since time.Time, limit int) ([]FanOutSyncItem, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT m.id, m.conversation_id, m.sender_id, m.sender_device_id, m.receiver_id, m.client_message_id,
		       mr.receiver_device_id, mr.ciphertext, mr.header_json, mr.status,
		       m.server_received_at, mr.delivered_at, mr.read_at
		FROM message_recipients mr
		INNER JOIN messages m ON m.id = mr.message_id
		WHERE mr.receiver_device_id = ? AND m.server_received_at > ? AND m.fan_out = TRUE
		ORDER BY m.server_received_at ASC
		LIMIT ?
	`, deviceID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []FanOutSyncItem
	for rows.Next() {
		var item FanOutSyncItem
		if err := rows.Scan(
			&item.MessageID, &item.ConversationID, &item.SenderID, &item.SenderDeviceID,
			&item.ReceiverID, &item.ClientMessageID,
			&item.ReceiverDeviceID, &item.Ciphertext, &item.HeaderJSON, &item.Status,
			&item.ServerReceivedAt, &item.DeliveredAt, &item.ReadAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// FanOutSyncItem represents a synced message for a specific device.
type FanOutSyncItem struct {
	MessageID        int64      `json:"id"`
	ConversationID   int64      `json:"conversation_id"`
	SenderID         int64      `json:"sender_id"`
	SenderDeviceID   int64      `json:"sender_device_id"`
	ReceiverID       int64      `json:"receiver_id"`
	ClientMessageID  string     `json:"client_message_id"`
	ReceiverDeviceID int64      `json:"receiver_device_id"`
	Ciphertext       []byte     `json:"-"`
	HeaderJSON       string     `json:"-"`
	Status           string     `json:"status"`
	ServerReceivedAt time.Time  `json:"created_at"`
	DeliveredAt      *time.Time `json:"delivered_at,omitempty"`
	ReadAt           *time.Time `json:"read_at,omitempty"`
}

// CiphertextB64 returns base64-encoded ciphertext for JSON serialization.
func (f *FanOutSyncItem) CiphertextB64() string {
	return base64.StdEncoding.EncodeToString(f.Ciphertext)
}

// ParsedHeader returns header as a raw JSON value.
func (f *FanOutSyncItem) ParsedHeader() any {
	var obj any
	if err := json.Unmarshal([]byte(f.HeaderJSON), &obj); err != nil {
		return f.HeaderJSON
	}
	return obj
}
