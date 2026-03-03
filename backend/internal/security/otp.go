package security

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
)

type OTPResult string

const (
	OTPValid    OTPResult = "valid"
	OTPInvalid  OTPResult = "invalid"
	OTPExceeded OTPResult = "attempts_exceeded"
	OTPNotFound OTPResult = "not_found"
)

type OTPState struct {
	CodeHash    string `json:"code_hash"`
	Attempts    int    `json:"attempts"`
	MaxAttempts int    `json:"max_attempts"`
	Identifier  string `json:"identifier"`
	Purpose     string `json:"purpose"`
}

func GenerateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func NewOTPState(identifier, purpose, code string, maxAttempts int) (*OTPState, error) {
	if maxAttempts <= 0 {
		return nil, errors.New("max attempts must be > 0")
	}
	return &OTPState{
		CodeHash:    SHA256Hex(code),
		Attempts:    0,
		MaxAttempts: maxAttempts,
		Identifier:  identifier,
		Purpose:     purpose,
	}, nil
}

func (s *OTPState) Verify(input string) OTPResult {
	if s == nil {
		return OTPNotFound
	}
	if s.Attempts >= s.MaxAttempts {
		return OTPExceeded
	}
	if SHA256Hex(input) == s.CodeHash {
		return OTPValid
	}
	s.Attempts++
	if s.Attempts >= s.MaxAttempts {
		return OTPExceeded
	}
	return OTPInvalid
}
