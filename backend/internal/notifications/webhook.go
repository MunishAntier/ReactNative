package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"securemsg/backend/internal/repository"
)

type Webhook struct {
	store      *repository.Store
	url        string
	authHeader string
	client     *http.Client
}

func NewWebhook(store *repository.Store, url, authHeader string, timeout time.Duration) *Webhook {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &Webhook{
		store:      store,
		url:        strings.TrimSpace(url),
		authHeader: strings.TrimSpace(authHeader),
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

func (w *Webhook) SendMessageWakeup(ctx context.Context, userID int64, messageID int64) error {
	if w.store == nil || w.url == "" {
		return nil
	}

	device, err := w.store.GetLatestDeviceByUser(ctx, userID)
	if err != nil || device == nil || device.PushToken == nil || strings.TrimSpace(*device.PushToken) == "" {
		return err
	}

	payload := map[string]any{
		"event":      "message.wakeup",
		"user_id":    userID,
		"device_id":  device.ID,
		"platform":   device.Platform,
		"push_token": *device.PushToken,
		"message_id": messageID,
		"ts":         time.Now().UTC().Format(time.RFC3339Nano),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, w.url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if w.authHeader != "" {
		req.Header.Set("Authorization", w.authHeader)
	}

	resp, err := w.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("push webhook status %d", resp.StatusCode)
	}
	return nil
}
