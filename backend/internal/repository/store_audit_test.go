package repository

import (
	"context"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestSaveAuditEvent(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	defer db.Close()

	store := NewStore(db)
	userID := int64(11)
	deviceID := int64(22)

	mock.ExpectExec("INSERT INTO audit_events").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), "auth.otp.verify.succeeded", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err = store.SaveAuditEvent(context.Background(), &userID, &deviceID, "auth.otp.verify.succeeded", map[string]any{"request_id": "abc"}, time.Now().UTC())
	if err != nil {
		t.Fatalf("save audit event: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestMarkDeliveredByReceiverUnauthorizedReturnsNil(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	defer db.Close()

	store := NewStore(db)
	messageID := int64(999)
	receiverID := int64(44)

	mock.ExpectExec("UPDATE messages").
		WithArgs(sqlmock.AnyArg(), messageID, receiverID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	msg, err := store.MarkDeliveredByReceiver(context.Background(), messageID, receiverID, time.Now().UTC())
	if err != nil {
		t.Fatalf("mark delivered by receiver: %v", err)
	}
	if msg != nil {
		t.Fatalf("expected nil message on unauthorized/no-op update")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
