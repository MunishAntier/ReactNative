package http

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"securemsg/backend/internal/config"
)

func TestRouterAuthStartRateLimitIncludesHeadersAndRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mini, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	defer mini.Close()

	redisClient := redis.NewClient(&redis.Options{Addr: mini.Addr()})
	defer redisClient.Close()

	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	defer db.Close()

	cfg := testRouterConfig(t)
	cfg.RateLimitAuthStartPerMinute = 1
	cfg.RateLimitPerMinute = 100
	cfg.OTPDevExpose = true

	app := NewRouter(cfg, db, redisClient)

	originalLogWriter := log.Writer()
	log.SetOutput(io.Discard)
	defer log.SetOutput(originalLogWriter)

	payload := map[string]any{
		"identifier": "ratelimit@example.com",
		"purpose":    "login",
	}
	body, _ := json.Marshal(payload)

	firstReq := httptest.NewRequest(http.MethodPost, "/v1/auth/start", bytes.NewReader(body))
	firstReq.Header.Set("Content-Type", "application/json")
	firstReq.RemoteAddr = "198.51.100.10:12345"
	firstResp := httptest.NewRecorder()
	app.Engine.ServeHTTP(firstResp, firstReq)
	if firstResp.Code != http.StatusOK {
		t.Fatalf("first request expected 200 got %d body=%s", firstResp.Code, firstResp.Body.String())
	}

	secondReq := httptest.NewRequest(http.MethodPost, "/v1/auth/start", bytes.NewReader(body))
	secondReq.Header.Set("Content-Type", "application/json")
	secondReq.RemoteAddr = "198.51.100.10:12345"
	secondResp := httptest.NewRecorder()
	app.Engine.ServeHTTP(secondResp, secondReq)
	if secondResp.Code != http.StatusTooManyRequests {
		t.Fatalf("second request expected 429 got %d body=%s", secondResp.Code, secondResp.Body.String())
	}

	if got := secondResp.Header().Get("X-Request-ID"); got == "" {
		t.Fatalf("expected X-Request-ID header on rate-limited response")
	}
	if got := secondResp.Header().Get("X-RateLimit-Limit"); got != "1" {
		t.Fatalf("expected X-RateLimit-Limit=1 got %q", got)
	}
	if got := secondResp.Header().Get("X-RateLimit-Remaining"); got != "0" {
		t.Fatalf("expected X-RateLimit-Remaining=0 got %q", got)
	}

	var response map[string]any
	if err := json.Unmarshal(secondResp.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if _, ok := response["request_id"]; !ok {
		t.Fatalf("expected request_id in rate-limit response payload")
	}
	if got, ok := response["scope"].(string); !ok || got != "auth_start" {
		t.Fatalf("expected scope auth_start got %#v", response["scope"])
	}
}

func testRouterConfig(t *testing.T) *config.Config {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate keypair: %v", err)
	}
	return &config.Config{
		AppEnv:                         "test",
		Port:                           "8080",
		JWTIssuer:                      "securemsg-test",
		JWTPrivateKey:                  priv,
		JWTPublicKey:                   pub,
		AccessTokenTTL:                 15 * time.Minute,
		RefreshTokenTTL:                30 * 24 * time.Hour,
		OTPTTL:                         5 * time.Minute,
		OTPMaxAttempts:                 5,
		OTPDevExpose:                   true,
		RateLimitPerMinute:             30,
		RateLimitAuthStartPerMinute:    10,
		RateLimitAuthVerifyPerMinute:   12,
		RateLimitAuthRefreshPerMinute:  30,
		RateLimitWSConnectPerMinute:    60,
		RateLimitAuthedPerMinute:       120,
		RateLimitKeysFetchPerMinute:    60,
		RateLimitMessagesSyncPerMinute: 120,
		RateLimitMessageReadPerMinute:  180,
		PreKeyLowThreshold:             20,
		MessageRetentionDays:           30,
	}
}
