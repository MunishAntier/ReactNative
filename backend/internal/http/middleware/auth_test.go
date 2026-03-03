package middleware

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"securemsg/backend/internal/security"

	"github.com/gin-gonic/gin"
)

func TestAuthRequiredRejectsInactiveSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tm := testTokenManager(t)
	token, _, err := tm.IssueAccessToken(77, 8, "sid-inactive", time.Now().UTC())
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}

	engine := gin.New()
	engine.Use(AuthRequired(tm, func(_ context.Context, _ int64, _ int64, _ string) (bool, error) {
		return false, nil
	}))
	engine.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	engine.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 got %d body=%s", resp.Code, resp.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got, _ := payload["error"].(string); got != "session inactive" {
		t.Fatalf("expected session inactive error got %q", got)
	}
}

func TestAuthRequiredAllowsActiveSessionAndSetsClaims(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tm := testTokenManager(t)
	token, _, err := tm.IssueAccessToken(33, 9, "sid-active", time.Now().UTC())
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}

	engine := gin.New()
	engine.Use(AuthRequired(tm, func(_ context.Context, userID, deviceID int64, sessionID string) (bool, error) {
		if userID != 33 || deviceID != 9 || sessionID != "sid-active" {
			t.Fatalf("unexpected claims passed to session checker: uid=%d did=%d sid=%s", userID, deviceID, sessionID)
		}
		return true, nil
	}))
	engine.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"user_id":    CurrentUserID(c),
			"device_id":  CurrentDeviceID(c),
			"session_id": CurrentSessionID(c),
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	engine.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d body=%s", resp.Code, resp.Body.String())
	}

	var payload struct {
		UserID    int64  `json:"user_id"`
		DeviceID  int64  `json:"device_id"`
		SessionID string `json:"session_id"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.UserID != 33 || payload.DeviceID != 9 || payload.SessionID != "sid-active" {
		t.Fatalf("unexpected claim payload: %+v", payload)
	}
}

func TestAuthRequiredReturnsServiceUnavailableOnSessionCheckError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tm := testTokenManager(t)
	token, _, err := tm.IssueAccessToken(11, 22, "sid-error", time.Now().UTC())
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}

	engine := gin.New()
	engine.Use(AuthRequired(tm, func(_ context.Context, _ int64, _ int64, _ string) (bool, error) {
		return false, errors.New("boom")
	}))
	engine.GET("/protected", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	engine.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 got %d body=%s", resp.Code, resp.Body.String())
	}
}

func testTokenManager(t *testing.T) *security.TokenManager {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate keypair: %v", err)
	}
	return security.NewTokenManager("securemsg-test", priv, pub, 15*time.Minute, 30*24*time.Hour)
}
