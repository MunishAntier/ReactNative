package security

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
	"time"
)

func TestAccessTokenRoundtrip(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	tm := NewTokenManager("test", priv, pub, 15*time.Minute, 24*time.Hour)
	now := time.Now().UTC()
	token, _, err := tm.IssueAccessToken(10, 20, "sid-1", now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	claims, err := tm.ParseAccessToken(token)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.UID != 10 || claims.DID != 20 || claims.SID != "sid-1" {
		t.Fatalf("claims mismatch: %+v", claims)
	}
}

func TestGenerateOpaqueToken(t *testing.T) {
	tok, err := GenerateOpaqueToken()
	if err != nil {
		t.Fatalf("opaque token: %v", err)
	}
	if len(tok) < 16 {
		t.Fatalf("unexpected token length: %d", len(tok))
	}
}
