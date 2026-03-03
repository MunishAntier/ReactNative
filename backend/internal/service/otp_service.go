package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"securemsg/backend/internal/security"

	"github.com/redis/go-redis/v9"
)

var (
	ErrOTPRateLimited   = errors.New("otp rate limit exceeded")
	ErrOTPInvalid       = errors.New("invalid otp")
	ErrOTPNotFound      = errors.New("otp not found or expired")
	ErrOTPAttemptsLimit = errors.New("otp attempts exceeded")
)

type OTPService struct {
	redis           *redis.Client
	ttl             time.Duration
	maxAttempts     int
	rateLimitPerMin int
}

func NewOTPService(redis *redis.Client, ttl time.Duration, maxAttempts int, rateLimitPerMin int) *OTPService {
	return &OTPService{
		redis:           redis,
		ttl:             ttl,
		maxAttempts:     maxAttempts,
		rateLimitPerMin: rateLimitPerMin,
	}
}

func (s *OTPService) Start(ctx context.Context, identifier, purpose, ip, deviceFingerprint string) (string, error) {
	now := time.Now().UTC()
	minuteBucket := now.Format("200601021504")
	if err := s.hitRateLimit(ctx, "id", security.SHA256Hex(identifier), minuteBucket); err != nil {
		return "", err
	}
	if ip != "" {
		if err := s.hitRateLimit(ctx, "ip", security.SHA256Hex(ip), minuteBucket); err != nil {
			return "", err
		}
	}
	if deviceFingerprint != "" {
		if err := s.hitRateLimit(ctx, "dev", security.SHA256Hex(deviceFingerprint), minuteBucket); err != nil {
			return "", err
		}
	}

	otp, err := security.GenerateOTP()
	if err != nil {
		return "", err
	}
	state, err := security.NewOTPState(identifier, purpose, otp, s.maxAttempts)
	if err != nil {
		return "", err
	}
	stateJSON, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	if err := s.redis.Set(ctx, s.otpKey(identifier), stateJSON, s.ttl).Err(); err != nil {
		return "", err
	}
	return otp, nil
}

func (s *OTPService) Verify(ctx context.Context, identifier, code string) error {
	key := s.otpKey(identifier)
	payload, err := s.redis.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return ErrOTPNotFound
	}
	if err != nil {
		return err
	}

	state := &security.OTPState{}
	if err := json.Unmarshal([]byte(payload), state); err != nil {
		return err
	}

	result := state.Verify(code)
	switch result {
	case security.OTPValid:
		_ = s.redis.Del(ctx, key).Err()
		return nil
	case security.OTPNotFound:
		return ErrOTPNotFound
	case security.OTPExceeded:
		_ = s.redis.Del(ctx, key).Err()
		return ErrOTPAttemptsLimit
	case security.OTPInvalid:
		updated, _ := json.Marshal(state)
		ttl := s.redis.TTL(ctx, key).Val()
		if ttl <= 0 {
			ttl = s.ttl
		}
		_ = s.redis.Set(ctx, key, updated, ttl).Err()
		return ErrOTPInvalid
	default:
		return ErrOTPInvalid
	}
}

func (s *OTPService) hitRateLimit(ctx context.Context, scope, keyPart, bucket string) error {
	key := fmt.Sprintf("otp:rl:%s:%s:%s", scope, keyPart, bucket)
	count, err := s.redis.Incr(ctx, key).Result()
	if err != nil {
		return err
	}
	if count == 1 {
		_ = s.redis.Expire(ctx, key, 70*time.Second).Err()
	}
	if count > int64(s.rateLimitPerMin) {
		return ErrOTPRateLimited
	}
	return nil
}

func (s *OTPService) otpKey(identifier string) string {
	return "otp:" + security.SHA256Hex(identifier)
}
