package security

import "testing"

func TestOTPStateVerify(t *testing.T) {
	state, err := NewOTPState("a@example.com", "login", "123456", 2)
	if err != nil {
		t.Fatalf("new state: %v", err)
	}
	if got := state.Verify("000000"); got != OTPInvalid {
		t.Fatalf("expected invalid, got %s", got)
	}
	if got := state.Verify("111111"); got != OTPExceeded {
		t.Fatalf("expected exceeded on second failure, got %s", got)
	}
	if got := state.Verify("123456"); got != OTPExceeded {
		t.Fatalf("expected exceeded after lock, got %s", got)
	}
}

func TestOTPStateSuccess(t *testing.T) {
	state, err := NewOTPState("a@example.com", "login", "123456", 5)
	if err != nil {
		t.Fatalf("new state: %v", err)
	}
	if got := state.Verify("123456"); got != OTPValid {
		t.Fatalf("expected valid, got %s", got)
	}
}
