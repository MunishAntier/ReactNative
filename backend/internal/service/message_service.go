package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
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

func (s *MessageService) Sync(ctx context.Context, receiverID int64, since time.Time, limit int) ([]domain.Message, error) {
	messages, err := s.store.SyncMessages(ctx, receiverID, since, limit)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	for _, m := range messages {
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
	return messages, nil
}
