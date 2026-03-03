package service

import (
	"context"
	"time"

	"securemsg/backend/internal/repository"
)

type AuditService struct {
	store *repository.Store
}

func NewAuditService(store *repository.Store) *AuditService {
	return &AuditService{store: store}
}

func (s *AuditService) Log(ctx context.Context, userID *int64, deviceID *int64, eventType string, metadata any) error {
	if s == nil {
		return nil
	}
	return s.store.SaveAuditEvent(ctx, userID, deviceID, eventType, metadata, time.Now().UTC())
}
