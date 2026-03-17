package handlers

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"securemsg/backend/internal/domain"
	"securemsg/backend/internal/http/middleware"
	"securemsg/backend/internal/security"

	"github.com/gin-gonic/gin"
)

func (h *Handler) UsersLookup(c *gin.Context) {
	identifier := c.Query("identifier")
	normalized, err := security.NormalizeIdentifier(identifier)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	column := string(normalized.Type)
	var query string
	if column == "email" {
		query = "SELECT id, email, phone, email_verified, phone_verified, created_at, updated_at FROM users WHERE email = ? LIMIT 1"
	} else {
		query = "SELECT id, email, phone, email_verified, phone_verified, created_at, updated_at FROM users WHERE phone = ? LIMIT 1"
	}
	user := domain.User{}
	err = h.DB.QueryRowContext(c.Request.Context(), query, normalized.Value).Scan(
		&user.ID, &user.Email, &user.Phone, &user.EmailVerified, &user.PhoneVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *Handler) ListConversations(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	items, err := h.Message.ListConversations(c.Request.Context(), userID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) SyncMessages(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	sinceStr := c.Query("since")
	if sinceStr == "" {
		sinceStr = time.Unix(0, 0).UTC().Format(time.RFC3339)
	}
	since, err := time.Parse(time.RFC3339, sinceStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "since must be RFC3339"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	deviceID := middleware.CurrentDeviceID(c)
	msgs, err := h.Message.Sync(c.Request.Context(), userID, deviceID, since, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	items := make([]gin.H, 0, len(msgs))
	for _, m := range msgs {
		var header any
		_ = json.Unmarshal([]byte(m.HeaderJSON), &header)
		items = append(items, gin.H{
			"id":                m.ID,
			"conversation_id":   m.ConversationID,
			"sender_id":         m.SenderID,
			"sender_device_id":  m.SenderDeviceID,
			"receiver_id":       m.ReceiverID,
			"client_message_id": m.ClientMessageID,
			"ciphertext_b64":    base64.StdEncoding.EncodeToString(m.Ciphertext),
			"header":            header,
			"created_at":        m.ServerReceivedAt,
			"delivered_at":      m.DeliveredAt,
			"read_at":           m.ReadAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) MarkMessageRead(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	messageID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || messageID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.Message.AckRead(c.Request.Context(), userID, messageID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
