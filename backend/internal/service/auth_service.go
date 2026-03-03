package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"securemsg/backend/internal/domain"
	"securemsg/backend/internal/repository"
	"securemsg/backend/internal/security"

	"github.com/google/uuid"
)

var (
	ErrRefreshInvalid = errors.New("refresh token invalid")
	ErrRefreshReuse   = errors.New("refresh token reuse detected")
)

type AuthService struct {
	store     *repository.Store
	otp       *OTPService
	tokens    *security.TokenManager
	otpExpose bool
}

type VerifyAuthInput struct {
	Identifier string
	OTP        string
	DeviceUUID string
	Platform   string
	PushToken  *string
}

type AuthTokens struct {
	AccessToken      string    `json:"access_token"`
	AccessExpiresAt  time.Time `json:"access_expires_at"`
	RefreshToken     string    `json:"refresh_token"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	UserID           int64     `json:"user_id"`
	DeviceID         int64     `json:"device_id"`
	SessionID        string    `json:"session_id"`
}

func NewAuthService(store *repository.Store, otp *OTPService, tokens *security.TokenManager, otpExpose bool) *AuthService {
	return &AuthService{store: store, otp: otp, tokens: tokens, otpExpose: otpExpose}
}

func (s *AuthService) StartAuth(ctx context.Context, identifier, purpose, ip, deviceFingerprint string) (map[string]any, error) {
	normalized, err := security.NormalizeIdentifier(identifier)
	if err != nil {
		return nil, err
	}
	otpCode, err := s.otp.Start(ctx, normalized.Value, purpose, ip, deviceFingerprint)
	if err != nil {
		return nil, err
	}
	response := map[string]any{
		"identifier":      normalized.Value,
		"purpose":         purpose,
		"otp_ttl_seconds": int64(300),
	}
	if s.otpExpose {
		response["dev_otp"] = otpCode
	}
	return response, nil
}

func (s *AuthService) VerifyAuth(ctx context.Context, input VerifyAuthInput) (*AuthTokens, error) {
	normalized, err := security.NormalizeIdentifier(input.Identifier)
	if err != nil {
		return nil, err
	}
	if input.DeviceUUID == "" {
		return nil, errors.New("device_uuid is required")
	}
	if err := s.otp.Verify(ctx, normalized.Value, input.OTP); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	user, err := s.store.CreateOrGetUserByIdentifier(ctx, string(normalized.Type), normalized.Value, now)
	if err != nil {
		return nil, err
	}
	device, err := s.store.UpsertDevice(ctx, user.ID, input.DeviceUUID, input.Platform, input.PushToken, now)
	if err != nil {
		return nil, err
	}
	sessionID := uuid.NewString()
	familyID := uuid.NewString()
	accessToken, accessExpiresAt, err := s.tokens.IssueAccessToken(user.ID, device.ID, sessionID, now)
	if err != nil {
		return nil, err
	}
	refreshToken, err := security.GenerateOpaqueToken()
	if err != nil {
		return nil, err
	}
	refreshRecord := domain.RefreshTokenRecord{
		UserID:    user.ID,
		DeviceID:  device.ID,
		TokenHash: security.SHA256Hex(refreshToken),
		FamilyID:  familyID,
		SessionID: sessionID,
		IssuedAt:  now,
		ExpiresAt: now.Add(s.tokens.RefreshTTL()),
	}
	if _, err := s.store.StoreRefreshToken(ctx, refreshRecord); err != nil {
		return nil, err
	}
	return &AuthTokens{
		AccessToken:      accessToken,
		AccessExpiresAt:  accessExpiresAt,
		RefreshToken:     refreshToken,
		RefreshExpiresAt: refreshRecord.ExpiresAt,
		UserID:           user.ID,
		DeviceID:         device.ID,
		SessionID:        sessionID,
	}, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*AuthTokens, error) {
	now := time.Now().UTC()
	lookup, err := s.store.FindRefreshTokenByHash(ctx, security.SHA256Hex(refreshToken))
	if err != nil {
		return nil, err
	}
	if lookup == nil {
		return nil, ErrRefreshInvalid
	}
	rec := lookup.Record
	if rec.RevokedAt != nil {
		_ = s.store.RevokeRefreshFamily(ctx, rec.FamilyID)
		return nil, ErrRefreshReuse
	}
	if rec.ExpiresAt.Before(now) {
		return nil, ErrRefreshInvalid
	}

	accessToken, accessExpiresAt, err := s.tokens.IssueAccessToken(rec.UserID, rec.DeviceID, rec.SessionID, now)
	if err != nil {
		return nil, err
	}
	newRefresh, err := security.GenerateOpaqueToken()
	if err != nil {
		return nil, err
	}
	next := domain.RefreshTokenRecord{
		UserID:    rec.UserID,
		DeviceID:  rec.DeviceID,
		TokenHash: security.SHA256Hex(newRefresh),
		FamilyID:  rec.FamilyID,
		SessionID: rec.SessionID,
		IssuedAt:  now,
		ExpiresAt: now.Add(s.tokens.RefreshTTL()),
	}
	if _, err := s.store.RotateRefreshToken(ctx, rec.ID, next); err != nil {
		return nil, err
	}
	return &AuthTokens{
		AccessToken:      accessToken,
		AccessExpiresAt:  accessExpiresAt,
		RefreshToken:     newRefresh,
		RefreshExpiresAt: next.ExpiresAt,
		UserID:           rec.UserID,
		DeviceID:         rec.DeviceID,
		SessionID:        rec.SessionID,
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, sessionID string) error {
	if sessionID == "" {
		return fmt.Errorf("session id required")
	}
	return s.store.RevokeRefreshSession(ctx, sessionID)
}

func (s *AuthService) Me(ctx context.Context, userID int64) (*domain.User, error) {
	return s.store.GetUserByID(ctx, userID)
}

func (s *AuthService) IsSessionActive(ctx context.Context, userID, deviceID int64, sessionID string) (bool, error) {
	if userID == 0 || deviceID == 0 || sessionID == "" {
		return false, nil
	}
	return s.store.IsSessionActive(ctx, userID, deviceID, sessionID, time.Now().UTC())
}
