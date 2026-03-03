package security

import (
	"errors"
	"regexp"
	"strings"
)

var (
	emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	phoneRegex = regexp.MustCompile(`^\+?[1-9][0-9]{7,14}$`)
)

type IdentifierType string

const (
	IdentifierEmail IdentifierType = "email"
	IdentifierPhone IdentifierType = "phone"
)

type NormalizedIdentifier struct {
	Type  IdentifierType
	Value string
}

func NormalizeIdentifier(raw string) (NormalizedIdentifier, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return NormalizedIdentifier{}, errors.New("identifier is required")
	}
	lower := strings.ToLower(value)
	if emailRegex.MatchString(lower) {
		return NormalizedIdentifier{Type: IdentifierEmail, Value: lower}, nil
	}

	compact := strings.ReplaceAll(value, " ", "")
	compact = strings.ReplaceAll(compact, "-", "")
	if phoneRegex.MatchString(compact) {
		if !strings.HasPrefix(compact, "+") {
			compact = "+" + compact
		}
		return NormalizedIdentifier{Type: IdentifierPhone, Value: compact}, nil
	}
	return NormalizedIdentifier{}, errors.New("identifier must be a valid email or E.164-like phone")
}
