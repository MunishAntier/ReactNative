package notifications

import (
	"strings"
	"time"

	"securemsg/backend/internal/repository"
)

func BuildService(store *repository.Store, provider, webhookURL, authHeader string, timeout time.Duration) Service {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "webhook":
		if strings.TrimSpace(webhookURL) != "" {
			return NewWebhook(store, webhookURL, authHeader, timeout)
		}
	}
	return Noop{}
}
