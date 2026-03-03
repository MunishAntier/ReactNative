package worker

import (
	"context"
	"log"
	"time"

	"securemsg/backend/internal/repository"
)

type RetentionWorker struct {
	store *repository.Store
}

func NewRetentionWorker(store *repository.Store) *RetentionWorker {
	return &RetentionWorker{store: store}
}

func (w *RetentionWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			deleted, err := w.store.DeleteExpiredMessages(ctx, time.Now().UTC())
			if err != nil {
				log.Printf("retention cleanup error: %v", err)
				continue
			}
			if deleted > 0 {
				log.Printf("retention cleanup deleted messages=%d", deleted)
			}
		}
	}
}
