package security

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type TokenManager struct {
	issuer     string
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	accessTTL  time.Duration
	refreshTTL time.Duration
}

type AccessClaims struct {
	UID int64  `json:"uid"`
	DID int64  `json:"did"`
	SID string `json:"sid"`
	jwt.RegisteredClaims
}

func NewTokenManager(issuer string, privateKey ed25519.PrivateKey, publicKey ed25519.PublicKey, accessTTL, refreshTTL time.Duration) *TokenManager {
	return &TokenManager{
		issuer:     issuer,
		privateKey: privateKey,
		publicKey:  publicKey,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

func (tm *TokenManager) IssueAccessToken(userID, deviceID int64, sessionID string, now time.Time) (string, time.Time, error) {
	expiresAt := now.Add(tm.accessTTL)
	claims := AccessClaims{
		UID: userID,
		DID: deviceID,
		SID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    tm.issuer,
			Subject:   fmt.Sprintf("%d", userID),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
	token, err := t.SignedString(tm.privateKey)
	if err != nil {
		return "", time.Time{}, err
	}
	return token, expiresAt, nil
}

func (tm *TokenManager) ParseAccessToken(token string) (*AccessClaims, error) {
	parsed, err := jwt.ParseWithClaims(token, &AccessClaims{}, func(_ *jwt.Token) (interface{}, error) {
		return tm.publicKey, nil
	}, jwt.WithIssuer(tm.issuer), jwt.WithValidMethods([]string{jwt.SigningMethodEdDSA.Alg()}))
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*AccessClaims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid access token")
	}
	return claims, nil
}

func (tm *TokenManager) RefreshTTL() time.Duration {
	return tm.refreshTTL
}

func GenerateOpaqueToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return "rt_" + base64.RawURLEncoding.EncodeToString(raw), nil
}
