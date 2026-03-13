package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"securemsg/backend/internal/domain"
	"securemsg/backend/internal/http/middleware"
	"securemsg/backend/internal/security"
	"securemsg/backend/internal/service"
	"securemsg/backend/internal/ws"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  2048,
	WriteBufferSize: 2048,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type wsEnvelope struct {
	Type string `json:"type"`
}

type wsMessageSend struct {
	Type             string               `json:"type"`
	ClientMessageID  string               `json:"client_message_id"`
	ReceiverUserID   int64                `json:"receiver_user_id"`
	ReceiverDeviceID int64                `json:"receiver_device_id"`
	CiphertextB64    string               `json:"ciphertext_b64"`
	Header           domain.MessageHeader `json:"header"`
	SentAtClient     *time.Time           `json:"sent_at_client"`
}

type wsFanOutCiphertext struct {
	ReceiverDeviceID int64                `json:"receiver_device_id"`
	CiphertextB64    string               `json:"ciphertext_b64"`
	Header           domain.MessageHeader `json:"header"`
}

type wsFanOutSend struct {
	Type            string               `json:"type"`
	ClientMessageID string               `json:"client_message_id"`
	ReceiverUserID  int64                `json:"receiver_user_id"`
	Ciphertexts     []wsFanOutCiphertext `json:"ciphertexts"`
	SentAtClient    *time.Time           `json:"sent_at_client"`
}

type wsAck struct {
	Type            string `json:"type"`
	ServerMessageID int64  `json:"server_message_id"`
}

type wsMessageSync struct {
	Type  string `json:"type"`
	Since string `json:"since"`
	Limit int    `json:"limit"`
}

func (h *Handler) WebSocket(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		header := c.GetHeader("Authorization")
		parts := strings.SplitN(header, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			token = parts[1]
		}
	}
	if token == "" {
		h.audit(c, "ws.connect.missing_token", nil, nil, gin.H{
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}
	claims, err := h.Tokens.ParseAccessToken(token)
	if err != nil {
		h.audit(c, "ws.connect.invalid_token", nil, nil, gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}
	sessionActive, sessionErr := h.Auth.IsSessionActive(c.Request.Context(), claims.UID, claims.DID, claims.SID)
	if sessionErr != nil {
		h.audit(c, "ws.connect.session_check_failed", int64Ptr(claims.UID), int64Ptr(claims.DID), gin.H{
			"session_id": claims.SID,
			"error":      sessionErr.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session validation unavailable"})
		return
	}
	if !sessionActive {
		h.audit(c, "ws.connect.inactive_session", int64Ptr(claims.UID), int64Ptr(claims.DID), gin.H{
			"session_id": claims.SID,
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusUnauthorized, gin.H{"error": "session inactive"})
		return
	}

	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	client := h.Hub.Register(conn, claims.UID, claims.DID)
	h.audit(c, "ws.connect.succeeded", int64Ptr(claims.UID), int64Ptr(claims.DID), gin.H{
		"session_id": claims.SID,
		"request_id": middleware.CurrentRequestID(c),
	})
	_ = h.Redis.Set(context.Background(), fmt.Sprintf("presence:user:%d", claims.UID), "online", 120*time.Second).Err()

	client.ReadLoop(func(_ int, payload []byte) error {
		active, activeErr := h.Auth.IsSessionActive(c.Request.Context(), claims.UID, claims.DID, claims.SID)
		if activeErr != nil {
			h.audit(c, "ws.session.check_failed", int64Ptr(claims.UID), int64Ptr(claims.DID), gin.H{
				"session_id": claims.SID,
				"error":      activeErr.Error(),
				"request_id": middleware.CurrentRequestID(c),
			})
			return ws.DisconnectWithError(errors.New("session validation unavailable"))
		}
		if !active {
			h.audit(c, "ws.session.inactive", int64Ptr(claims.UID), int64Ptr(claims.DID), gin.H{
				"session_id": claims.SID,
				"request_id": middleware.CurrentRequestID(c),
			})
			return ws.DisconnectWithError(errors.New("session inactive"))
		}

		var env wsEnvelope
		if err := json.Unmarshal(payload, &env); err != nil {
			return err
		}
		switch env.Type {
		case "message.send":
			var msg wsMessageSend
			if err := json.Unmarshal(payload, &msg); err != nil {
				return err
			}
			stored, duplicate, err := h.Message.Send(c.Request.Context(), service.SendMessageInput{
				SenderID:         claims.UID,
				SenderDeviceID:   claims.DID,
				ReceiverUserID:   msg.ReceiverUserID,
				ReceiverDeviceID: msg.ReceiverDeviceID,
				ClientMessageID:  msg.ClientMessageID,
				CiphertextB64:    msg.CiphertextB64,
				Header:           msg.Header,
				SentAtClient:     msg.SentAtClient,
			})
			if err != nil {
				h.audit(c, "ws.message.send.failed", int64Ptr(claims.UID), int64Ptr(claims.DID), gin.H{
					"receiver_user_id": msg.ReceiverUserID,
					"error":            err.Error(),
					"request_id":       middleware.CurrentRequestID(c),
				})
				return err
			}
			status := "queued"
			if msg.ReceiverDeviceID > 0 {
				if h.Hub.IsDeviceOnline(msg.ReceiverUserID, msg.ReceiverDeviceID) {
					status = "delivered"
				}
			} else if h.Hub.IsOnline(msg.ReceiverUserID) {
				status = "delivered"
			}
			h.Hub.SendToUser(claims.UID, map[string]any{
				"type":              "message.status",
				"server_message_id": stored.ID,
				"client_message_id": stored.ClientMessageID,
				"status":            status,
				"duplicate":         duplicate,
			})
			return nil
		case "message.send.fanout":
			var msg wsFanOutSend
			if err := json.Unmarshal(payload, &msg); err != nil {
				return err
			}
			ciphertexts := make([]service.FanOutCiphertext, 0, len(msg.Ciphertexts))
			for _, ct := range msg.Ciphertexts {
				ciphertexts = append(ciphertexts, service.FanOutCiphertext{
					ReceiverDeviceID: ct.ReceiverDeviceID,
					CiphertextB64:    ct.CiphertextB64,
					Header:           ct.Header,
				})
			}
			stored, duplicate, err := h.Message.SendFanOut(c.Request.Context(), service.SendFanOutInput{
				SenderID:        claims.UID,
				SenderDeviceID:  claims.DID,
				ReceiverUserID:  msg.ReceiverUserID,
				ClientMessageID: msg.ClientMessageID,
				Ciphertexts:     ciphertexts,
				SentAtClient:    msg.SentAtClient,
			})
			if err != nil {
				h.audit(c, "ws.message.send.fanout.failed", int64Ptr(claims.UID), int64Ptr(claims.DID), gin.H{
					"receiver_user_id": msg.ReceiverUserID,
					"device_count":     len(msg.Ciphertexts),
					"error":            err.Error(),
					"request_id":       middleware.CurrentRequestID(c),
				})
				return err
			}
			// Build per-device delivery status
			deviceStatuses := make([]map[string]any, 0, len(msg.Ciphertexts))
			for _, ct := range msg.Ciphertexts {
				ds := map[string]any{
					"receiver_device_id": ct.ReceiverDeviceID,
					"status":             "queued",
				}
				if h.Hub.IsDeviceOnline(msg.ReceiverUserID, ct.ReceiverDeviceID) {
					ds["status"] = "delivered"
				}
				deviceStatuses = append(deviceStatuses, ds)
			}
			h.Hub.SendToUser(claims.UID, map[string]any{
				"type":              "message.status",
				"server_message_id": stored.ID,
				"client_message_id": msg.ClientMessageID,
				"status":            "fanout",
				"device_statuses":   deviceStatuses,
				"duplicate":         duplicate,
			})
			return nil
		case "message.ack.delivered":
			var ack wsAck
			if err := json.Unmarshal(payload, &ack); err != nil {
				return err
			}
			return h.Message.AckDelivered(c.Request.Context(), claims.UID, ack.ServerMessageID)
		case "message.ack.read":
			var ack wsAck
			if err := json.Unmarshal(payload, &ack); err != nil {
				return err
			}
			return h.Message.AckRead(c.Request.Context(), claims.UID, ack.ServerMessageID)
		case "presence.ping":
			_ = h.Redis.Set(context.Background(), fmt.Sprintf("presence:user:%d", claims.UID), "online", 120*time.Second).Err()
			return conn.WriteJSON(map[string]any{"type": "presence.pong", "ts": time.Now().UTC()})
		case "messages.sync":
			var syncReq wsMessageSync
			if err := json.Unmarshal(payload, &syncReq); err != nil {
				return err
			}
			since, parseErr := time.Parse(time.RFC3339, syncReq.Since)
			if parseErr != nil {
				return conn.WriteJSON(map[string]any{"type": "messages.sync.error", "error": "since must be RFC3339"})
			}
			limit := syncReq.Limit
			if limit <= 0 || limit > 500 {
				limit = 200
			}
			messages, syncErr := h.Message.Sync(c.Request.Context(), claims.UID, claims.DID, since, limit)
			if syncErr != nil {
				return conn.WriteJSON(map[string]any{"type": "messages.sync.error", "error": syncErr.Error()})
			}
			// Convert messages to response format with base64 ciphertext
			items := make([]map[string]any, 0, len(messages))
			for _, m := range messages {
				// Parse HeaderJSON back into a raw JSON object so it's not double-encoded
				var headerObj any
				if jsonErr := json.Unmarshal([]byte(m.HeaderJSON), &headerObj); jsonErr != nil {
					headerObj = m.HeaderJSON // fallback to string if parsing fails
				}
				items = append(items, map[string]any{
					"id":                m.ID,
					"conversation_id":   m.ConversationID,
					"sender_id":         m.SenderID,
					"sender_device_id":  m.SenderDeviceID,
					"receiver_id":       m.ReceiverID,
					"client_message_id": m.ClientMessageID,
					"ciphertext_b64":    base64.StdEncoding.EncodeToString(m.Ciphertext),
					"header":            headerObj,
					"created_at":        m.ServerReceivedAt,
					"delivered_at":      m.DeliveredAt,
					"read_at":           m.ReadAt,
				})
			}
			return conn.WriteJSON(map[string]any{
				"type":  "messages.sync.response",
				"items": items,
			})
		default:
			return errors.New("unsupported event type")
		}
	})
	h.audit(c, "ws.disconnect", int64Ptr(claims.UID), int64Ptr(claims.DID), gin.H{
		"session_id": claims.SID,
		"request_id": middleware.CurrentRequestID(c),
	})
	_ = h.Redis.Del(context.Background(), fmt.Sprintf("presence:user:%d", claims.UID)).Err()
}

func NotifyLowPrekeys(hub *ws.Hub, userID int64) {
	hub.SendToUser(userID, map[string]any{
		"type":    "prekeys.low",
		"message": "available one-time prekeys below threshold",
	})
}

func NotifyIdentityChanged(hub *ws.Hub, targetUserID int64, changedUserID int64, identityKeyVersion int) {
	hub.SendToUser(targetUserID, map[string]any{
		"type":                 "session.identity_changed",
		"message":              "peer identity key changed",
		"changed_user_id":      changedUserID,
		"identity_key_version": identityKeyVersion,
	})
}

func ValidateWSAccessToken(tokens *security.TokenManager, token string) error {
	_, err := tokens.ParseAccessToken(token)
	return err
}
