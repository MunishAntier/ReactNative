package config

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv                         string
	Port                           string
	MySQLDSN                       string
	RedisAddr                      string
	RedisPassword                  string
	RedisDB                        int
	JWTIssuer                      string
	JWTPrivateKey                  ed25519.PrivateKey
	JWTPublicKey                   ed25519.PublicKey
	AccessTokenTTL                 time.Duration
	RefreshTokenTTL                time.Duration
	OTPTTL                         time.Duration
	OTPMaxAttempts                 int
	OTPDevExpose                   bool
	RateLimitPerMinute             int
	RateLimitAuthStartPerMinute    int
	RateLimitAuthVerifyPerMinute   int
	RateLimitAuthRefreshPerMinute  int
	RateLimitWSConnectPerMinute    int
	RateLimitAuthedPerMinute       int
	RateLimitKeysFetchPerMinute    int
	RateLimitMessagesSyncPerMinute int
	RateLimitMessageReadPerMinute  int
	PreKeyLowThreshold             int
	MessageRetentionDays           int
	PushProvider                   string
	PushWebhookURL                 string
	PushWebhookAuthHeader          string
	PushRequestTimeout             time.Duration
	MaxDevicesPerUser              int
}

func Load() (*Config, error) {
	// Try to load .env from multiple locations for robustness
	_ = godotenv.Load(".env")                      // current working directory
	_ = godotenv.Load(filepath.Join("..", ".env")) // parent directory (when running from backend/)

	// Also try relative to the executable path
	if exe, err := os.Executable(); err == nil {
		_ = godotenv.Load(filepath.Join(filepath.Dir(exe), ".env"))
		_ = godotenv.Load(filepath.Join(filepath.Dir(exe), "..", ".env"))
	}

	baseRateLimit := getenvInt("RATE_LIMIT_PER_MINUTE", 30)
	cfg := &Config{
		AppEnv:                         getenv("APP_ENV", "development"),
		Port:                           getenv("APP_PORT", "8080"),
		MySQLDSN:                       getenv("MYSQL_DSN", "root:root@tcp(localhost:3306)/securemsg?parseTime=true"),
		RedisAddr:                      getenv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:                  getenv("REDIS_PASSWORD", ""),
		RedisDB:                        getenvInt("REDIS_DB", 0),
		JWTIssuer:                      getenv("JWT_ISSUER", "securemsg"),
		AccessTokenTTL:                 getenvDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:                getenvDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		OTPTTL:                         getenvDuration("OTP_TTL", 5*time.Minute),
		OTPMaxAttempts:                 getenvInt("OTP_MAX_ATTEMPTS", 5),
		OTPDevExpose:                   getenvBool("OTP_DEV_EXPOSE", true),
		RateLimitPerMinute:             baseRateLimit,
		RateLimitAuthStartPerMinute:    getenvInt("RATE_LIMIT_AUTH_START_PER_MINUTE", 10),
		RateLimitAuthVerifyPerMinute:   getenvInt("RATE_LIMIT_AUTH_VERIFY_PER_MINUTE", 12),
		RateLimitAuthRefreshPerMinute:  getenvInt("RATE_LIMIT_AUTH_REFRESH_PER_MINUTE", baseRateLimit),
		RateLimitWSConnectPerMinute:    getenvInt("RATE_LIMIT_WS_CONNECT_PER_MINUTE", 60),
		RateLimitAuthedPerMinute:       getenvInt("RATE_LIMIT_AUTHED_PER_MINUTE", baseRateLimit*4),
		RateLimitKeysFetchPerMinute:    getenvInt("RATE_LIMIT_KEYS_FETCH_PER_MINUTE", 60),
		RateLimitMessagesSyncPerMinute: getenvInt("RATE_LIMIT_MESSAGES_SYNC_PER_MINUTE", 120),
		RateLimitMessageReadPerMinute:  getenvInt("RATE_LIMIT_MESSAGE_READ_PER_MINUTE", 180),
		PreKeyLowThreshold:             getenvInt("PREKEY_LOW_THRESHOLD", 20),
		MessageRetentionDays:           getenvInt("MESSAGE_RETENTION_DAYS", 30),
		PushProvider:                   getenv("PUSH_PROVIDER", "noop"),
		PushWebhookURL:                 getenv("PUSH_WEBHOOK_URL", ""),
		PushWebhookAuthHeader:          getenv("PUSH_WEBHOOK_AUTH_HEADER", ""),
		PushRequestTimeout:             getenvDuration("PUSH_REQUEST_TIMEOUT", 5*time.Second),
		MaxDevicesPerUser:              getenvInt("MAX_DEVICES_PER_USER", 5),
	}

	priv, pub, err := loadOrGenerateEd25519Keypair()
	if err != nil {
		return nil, err
	}
	cfg.JWTPrivateKey = priv
	cfg.JWTPublicKey = pub
	return cfg, nil
}

func loadOrGenerateEd25519Keypair() (ed25519.PrivateKey, ed25519.PublicKey, error) {
	privB64 := os.Getenv("JWT_PRIVATE_KEY_B64")
	pubB64 := os.Getenv("JWT_PUBLIC_KEY_B64")
	if privB64 != "" && pubB64 != "" {
		privRaw, err := base64.StdEncoding.DecodeString(privB64)
		if err != nil {
			return nil, nil, fmt.Errorf("decode JWT private key: %w", err)
		}
		pubRaw, err := base64.StdEncoding.DecodeString(pubB64)
		if err != nil {
			return nil, nil, fmt.Errorf("decode JWT public key: %w", err)
		}
		if len(privRaw) != ed25519.PrivateKeySize || len(pubRaw) != ed25519.PublicKeySize {
			return nil, nil, fmt.Errorf("invalid ed25519 key sizes")
		}
		return ed25519.PrivateKey(privRaw), ed25519.PublicKey(pubRaw), nil
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate ed25519 keypair: %w", err)
	}
	return priv, pub, nil
}

func getenv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}

func getenvDuration(key string, fallback time.Duration) time.Duration {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		if parsed, err := time.ParseDuration(value); err == nil {
			return parsed
		}
	}
	return fallback
}

func getenvBool(key string, fallback bool) bool {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return fallback
}
