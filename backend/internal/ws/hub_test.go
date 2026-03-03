package ws

import (
	"errors"
	"testing"
)

func TestDisconnectErrorHelpers(t *testing.T) {
	baseErr := errors.New("session inactive")
	disconnectErr := DisconnectWithError(baseErr)

	if !IsDisconnectError(disconnectErr) {
		t.Fatalf("expected disconnect error to be recognized")
	}
	if disconnectErr.Error() != "session inactive" {
		t.Fatalf("unexpected disconnect error text: %q", disconnectErr.Error())
	}
	if IsDisconnectError(baseErr) {
		t.Fatalf("expected plain error not to be treated as disconnect")
	}
}
