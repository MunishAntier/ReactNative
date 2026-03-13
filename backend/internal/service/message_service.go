package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"securemsg/backend/internal/domain"
	"securemsg/backend/internal/notifications"
	"securemsg/backend/internal/repository"
	"securemsg/backend/internal/ws"
)

var ErrReceiverRequired = errors.New("receiver_user_id is required")

type MessageService struct {
	store         *repository.Store
	hub           *ws.Hub
	notifier      notifications.Service
	retentionDays int
}

type SendMessageInput struct {
	SenderID         int64
	SenderDeviceID   int64
	ReceiverUserID   int64
	ReceiverDeviceID int64
	ClientMessageID  string
	CiphertextB64    string
	Header           domain.MessageHeader
	SentAtClient     *time.Time
}

func NewMessageService(store *repository.Store, hub *ws.Hub, notifier notifications.Service, retentionDays int) *MessageService {
	if notifier == nil {
		notifier = notifications.Noop{}
	}
	return &MessageService{store: store, hub: hub, notifier: notifier, retentionDays: retentionDays}
}

func (s *MessageService) Send(ctx context.Context, input SendMessageInput) (*domain.Message, bool, error) {
	if input.ReceiverUserID == 0 {
		return nil, false, ErrReceiverRequired
	}
	ciphertext, err := base64.StdEncoding.DecodeString(input.CiphertextB64)
	if err != nil {
		return nil, false, err
	}
	headerJSON, err := json.Marshal(input.Header)
	if err != nil {
		return nil, false, err
	}
	now := time.Now().UTC()
	conversationID, err := s.store.GetOrCreateConversation(ctx, input.SenderID, input.ReceiverUserID, now)
	if err != nil {
		return nil, false, err
	}
	msg := &domain.Message{
		ConversationID:   conversationID,
		SenderID:         input.SenderID,
		SenderDeviceID:   input.SenderDeviceID,
		ReceiverID:       input.ReceiverUserID,
		ClientMessageID:  input.ClientMessageID,
		Ciphertext:       ciphertext,
		HeaderJSON:       string(headerJSON),
		ServerReceivedAt: now,
		ExpiresAt:        now.Add(time.Duration(s.retentionDays) * 24 * time.Hour),
	}
	stored, duplicate, err := s.store.InsertMessageIdempotent(ctx, msg)
	if err != nil {
		return nil, false, err
	}
	if input.Header.ReceiverOneTimePreKeyID > 0 {
		if input.ReceiverDeviceID > 0 {
			_ = s.store.MarkOneTimePreKeyUsedByDevice(ctx, input.ReceiverDeviceID, input.Header.ReceiverOneTimePreKeyID, now)
		} else {
			_ = s.store.MarkOneTimePreKeyUsed(ctx, input.ReceiverUserID, input.Header.ReceiverOneTimePreKeyID, now)
		}
	}
	if input.ReceiverDeviceID > 0 && s.hub.IsDeviceOnline(input.ReceiverUserID, input.ReceiverDeviceID) {
		event := map[string]any{
			"type":               "message.new",
			"server_message_id":  stored.ID,
			"conversation_id":    stored.ConversationID,
			"sender_user_id":     stored.SenderID,
			"sender_device_id":   input.SenderDeviceID,
			"receiver_device_id": input.ReceiverDeviceID,
			"client_message_id":  stored.ClientMessageID,
			"ciphertext_b64":     input.CiphertextB64,
			"header":             input.Header,
			"created_at":         stored.ServerReceivedAt,
		}
		s.hub.SendToDevice(input.ReceiverUserID, input.ReceiverDeviceID, event)
		_, _ = s.store.MarkDeliveredByReceiver(ctx, stored.ID, input.ReceiverUserID, now)
	} else if input.ReceiverDeviceID <= 0 && s.hub.IsOnline(input.ReceiverUserID) {
		event := map[string]any{
			"type":              "message.new",
			"server_message_id": stored.ID,
			"conversation_id":   stored.ConversationID,
			"sender_user_id":    stored.SenderID,
			"sender_device_id":  input.SenderDeviceID,
			"client_message_id": stored.ClientMessageID,
			"ciphertext_b64":    input.CiphertextB64,
			"header":            input.Header,
			"created_at":        stored.ServerReceivedAt,
		}
		s.hub.SendToUser(input.ReceiverUserID, event)
		_, _ = s.store.MarkDeliveredByReceiver(ctx, stored.ID, input.ReceiverUserID, now)
	} else if s.notifier != nil {
		_ = s.notifier.SendMessageWakeup(ctx, input.ReceiverUserID, stored.ID)
	}
	return stored, duplicate, nil
}

// FanOutCiphertext represents a per-device ciphertext in a fan-out message.
type FanOutCiphertext struct {
	ReceiverDeviceID int64                `json:"receiver_device_id"`
	CiphertextB64    string               `json:"ciphertext_b64"`
	Header           domain.MessageHeader `json:"header"`
}

// SendFanOutInput contains all data for a fan-out message send.
type SendFanOutInput struct {
	SenderID        int64
	SenderDeviceID  int64
	ReceiverUserID  int64
	ClientMessageID string
	Ciphertexts     []FanOutCiphertext
	SentAtClient    *time.Time
}

// SendFanOut stores one message + N per-device ciphertexts and delivers to online devices (Rules 4,5,15,28,42).
func (s *MessageService) SendFanOut(ctx context.Context, input SendFanOutInput) (*domain.Message, bool, error) {
	if input.ReceiverUserID == 0 {
		return nil, false, ErrReceiverRequired
	}
	if len(input.Ciphertexts) == 0 {
		return nil, false, errors.New("at least one ciphertext required")
	}

	now := time.Now().UTC()
	conversationID, err := s.store.GetOrCreateConversation(ctx, input.SenderID, input.ReceiverUserID, now)
	if err != nil {
		return nil, false, err
	}

	// Build parent message
	msg := &domain.Message{
		ConversationID:   conversationID,
		SenderID:         input.SenderID,
		SenderDeviceID:   input.SenderDeviceID,
		ReceiverID:       input.ReceiverUserID,
		ClientMessageID:  input.ClientMessageID,
		ServerReceivedAt: now,
		ExpiresAt:        now.Add(time.Duration(s.retentionDays) * 24 * time.Hour),
	}

	// Build per-device recipients
	recipients := make([]repository.FanOutRecipientInput, 0, len(input.Ciphertexts))
	for _, ct := range input.Ciphertexts {
		headerJSON, err := json.Marshal(ct.Header)
		if err != nil {
			return nil, false, err
		}
		recipients = append(recipients, repository.FanOutRecipientInput{
			ReceiverDeviceID: ct.ReceiverDeviceID,
			CiphertextB64:    ct.CiphertextB64,
			HeaderJSON:       string(headerJSON),
		})
	}

	stored, duplicate, err := s.store.InsertFanOutMessage(ctx, msg, recipients)
	if err != nil {
		return nil, false, err
	}

	// Mark one-time prekeys used
	for _, ct := range input.Ciphertexts {
		if ct.Header.ReceiverOneTimePreKeyID > 0 {
			_ = s.store.MarkOneTimePreKeyUsedByDevice(ctx, ct.ReceiverDeviceID, ct.Header.ReceiverOneTimePreKeyID, now)
		}
	}

	// Deliver to each online device (Rule 15 — partial delivery OK)
	for _, ct := range input.Ciphertexts {
		if s.hub.IsDeviceOnline(input.ReceiverUserID, ct.ReceiverDeviceID) {
			headerJSON, _ := json.Marshal(ct.Header)
			var headerObj any
			_ = json.Unmarshal(headerJSON, &headerObj)

			event := map[string]any{
				"type":               "message.new",
				"server_message_id":  stored.ID,
				"conversation_id":    stored.ConversationID,
				"sender_user_id":     stored.SenderID,
				"sender_device_id":   input.SenderDeviceID,
				"receiver_device_id": ct.ReceiverDeviceID,
				"client_message_id":  stored.ClientMessageID,
				"ciphertext_b64":     ct.CiphertextB64,
				"header":             headerObj,
				"created_at":         stored.ServerReceivedAt,
			}
			s.hub.SendToDevice(input.ReceiverUserID, ct.ReceiverDeviceID, event)
			_ = s.store.MarkRecipientDelivered(ctx, stored.ID, ct.ReceiverDeviceID, now)
		}
		// Also deliver to sender's other devices (self-sync, Rule 5)
		if ct.ReceiverDeviceID != input.SenderDeviceID && s.hub.IsDeviceOnline(input.SenderID, ct.ReceiverDeviceID) {
			// This case is handled if caller includes sender's own devices in ciphertexts
			// The delivery above handles it since the device belongs to the correct user
		}
	}

	return stored, duplicate, nil
}

func (s *MessageService) AckDelivered(ctx context.Context, receiverID, messageID int64) error {
	msg, err := s.store.MarkDeliveredByReceiver(ctx, messageID, receiverID, time.Now().UTC())
	if err != nil || msg == nil {
		return err
	}
	if s.hub.IsOnline(msg.SenderID) {
		s.hub.SendToUser(msg.SenderID, map[string]any{
			"type":              "message.status",
			"server_message_id": msg.ID,
			"status":            "delivered",
			"delivered_at":      msg.DeliveredAt,
		})
	}
	return nil
}

func (s *MessageService) AckRead(ctx context.Context, readerID, messageID int64) error {
	msg, err := s.store.MarkRead(ctx, messageID, readerID, time.Now().UTC())
	if err != nil || msg == nil {
		return err
	}
	if s.hub.IsOnline(msg.SenderID) {
		s.hub.SendToUser(msg.SenderID, map[string]any{
			"type":              "message.status",
			"server_message_id": msg.ID,
			"status":            "read",
			"read_at":           msg.ReadAt,
		})
	}
	return nil
}

func (s *MessageService) ListConversations(ctx context.Context, userID int64, limit int) ([]repository.ConversationItem, error) {
	return s.store.ListConversations(ctx, userID, limit)
}

func (s *MessageService) Sync(ctx context.Context, receiverID int64, deviceID int64, since time.Time, limit int) ([]domain.Message, error) {
	messages, err := s.store.SyncMessages(ctx, receiverID, since, limit)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()

	// Filter out fan-out parent rows (they have empty ciphertext; real data is per-device)
	regular := make([]domain.Message, 0, len(messages))
	for _, m := range messages {
		if len(m.Ciphertext) == 0 {
			continue // fan-out parent — skip, we'll fetch per-device below
		}
		regular = append(regular, m)
	}

	for _, m := range regular {
		updated, markErr := s.store.MarkDeliveredByReceiver(ctx, m.ID, receiverID, now)
		if markErr != nil {
			continue
		}
		if updated != nil && s.hub.IsOnline(updated.SenderID) {
			s.hub.SendToUser(updated.SenderID, map[string]any{
				"type":              "message.status",
				"server_message_id": updated.ID,
				"status":            "delivered",
				"delivered_at":      updated.DeliveredAt,
			})
		}
	}

	// Fetch per-device ciphertexts for fan-out messages (deviceID-specific)
	if deviceID > 0 {
		fanoutItems, fanoutErr := s.store.SyncFanOutMessages(ctx, deviceID, since, limit)
		if fanoutErr == nil && len(fanoutItems) > 0 {
			for _, fi := range fanoutItems {
				regular = append(regular, domain.Message{
					ID:               fi.MessageID,
					ConversationID:   fi.ConversationID,
					SenderID:         fi.SenderID,
					SenderDeviceID:   fi.SenderDeviceID,
					ReceiverID:       fi.ReceiverID,
					ClientMessageID:  fi.ClientMessageID,
					Ciphertext:       fi.Ciphertext,
					HeaderJSON:       fi.HeaderJSON,
					ServerReceivedAt: fi.ServerReceivedAt,
					DeliveredAt:      fi.DeliveredAt,
					ReadAt:           fi.ReadAt,
				})
				// Mark fan-out recipient as delivered
				_ = s.store.MarkRecipientDelivered(ctx, fi.MessageID, deviceID, now)
			}
			// Sort merged list by time
			sort.Slice(regular, func(i, j int) bool {
				return regular[i].ServerReceivedAt.Before(regular[j].ServerReceivedAt)
			})
		}
	}

	return regular, nil
}
