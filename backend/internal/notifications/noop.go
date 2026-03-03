package notifications

import "context"

type Service interface {
	SendMessageWakeup(ctx context.Context, userID int64, messageID int64) error
}

type Noop struct{}

func (Noop) SendMessageWakeup(context.Context, int64, int64) error {
	return nil
}
