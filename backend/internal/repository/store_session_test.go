package repository

import (
	"context"
	"database/sql"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestIsSessionActiveReturnsTrueWhenUnrevokedTokenExists(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	defer db.Close()

	store := NewStore(db)
	userID := int64(5)
	deviceID := int64(7)
	sessionID := "sid-active"
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT 1\\s+FROM refresh_tokens").
		WithArgs(userID, deviceID, sessionID, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))

	active, err := store.IsSessionActive(context.Background(), userID, deviceID, sessionID, now)
	if err != nil {
		t.Fatalf("is session active: %v", err)
	}
	if !active {
		t.Fatalf("expected active session")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestIsSessionActiveReturnsFalseWhenNoRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	defer db.Close()

	store := NewStore(db)
	userID := int64(9)
	deviceID := int64(3)
	sessionID := "sid-revoked"
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT 1\\s+FROM refresh_tokens").
		WithArgs(userID, deviceID, sessionID, sqlmock.AnyArg()).
		WillReturnError(sql.ErrNoRows)

	active, err := store.IsSessionActive(context.Background(), userID, deviceID, sessionID, now)
	if err != nil {
		t.Fatalf("is session active: %v", err)
	}
	if active {
		t.Fatalf("expected inactive session when no matching token row exists")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
