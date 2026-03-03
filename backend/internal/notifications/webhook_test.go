package notifications

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"

	"securemsg/backend/internal/repository"
)

func TestWebhookSendMessageWakeupPostsPayload(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	defer db.Close()

	var (
		capturedAuth    string
		capturedPayload map[string]any
	)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &capturedPayload)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	now := time.Now().UTC()
	pushToken := "ptk-123"
	mock.ExpectQuery("FROM devices").
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "device_uuid", "platform", "push_token", "last_seen_at", "created_at", "updated_at",
		}).AddRow(11, 42, "device-1", "android", pushToken, now, now, now))

	store := repository.NewStore(db)
	service := NewWebhook(store, server.URL, "Bearer test-token", time.Second)
	if err := service.SendMessageWakeup(context.Background(), 42, 777); err != nil {
		t.Fatalf("send wakeup: %v", err)
	}

	if capturedAuth != "Bearer test-token" {
		t.Fatalf("expected authorization header, got %q", capturedAuth)
	}
	if capturedPayload["event"] != "message.wakeup" {
		t.Fatalf("expected event message.wakeup, got %#v", capturedPayload["event"])
	}
	if int64FromAny(capturedPayload["user_id"]) != 42 {
		t.Fatalf("expected user_id 42, got %#v", capturedPayload["user_id"])
	}
	if int64FromAny(capturedPayload["message_id"]) != 777 {
		t.Fatalf("expected message_id 777, got %#v", capturedPayload["message_id"])
	}
	if capturedPayload["push_token"] != pushToken {
		t.Fatalf("expected push token %q, got %#v", pushToken, capturedPayload["push_token"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestWebhookSendMessageWakeupSkipsDeviceWithoutPushToken(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	defer db.Close()

	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("FROM devices").
		WithArgs(int64(55)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "device_uuid", "platform", "push_token", "last_seen_at", "created_at", "updated_at",
		}).AddRow(2, 55, "device-2", "ios", nil, now, now, now))

	store := repository.NewStore(db)
	service := NewWebhook(store, server.URL, "", time.Second)
	if err := service.SendMessageWakeup(context.Background(), 55, 901); err != nil {
		t.Fatalf("send wakeup: %v", err)
	}

	if callCount != 0 {
		t.Fatalf("expected no webhook call for empty push token, got %d", callCount)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func int64FromAny(value any) int64 {
	switch v := value.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	default:
		return 0
	}
}
