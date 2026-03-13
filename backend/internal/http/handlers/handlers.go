package handlers

import (
	"database/sql"

	"securemsg/backend/internal/http/middleware"
	"securemsg/backend/internal/repository"
	"securemsg/backend/internal/security"
	"securemsg/backend/internal/service"
	"securemsg/backend/internal/ws"

	"github.com/redis/go-redis/v9"
)

type Handler struct {
	Auth             *service.AuthService
	Keys             *service.KeyService
	Message          *service.MessageService
	Audit            *service.AuditService
	MetricsCollector *middleware.MetricsCollector
	Tokens           *security.TokenManager
	Hub              *ws.Hub
	Redis            *redis.Client
	DB               *sql.DB
	Store            *repository.Store
}

func New(
	auth *service.AuthService,
	keys *service.KeyService,
	message *service.MessageService,
	audit *service.AuditService,
	metricsCollector *middleware.MetricsCollector,
	tokens *security.TokenManager,
	hub *ws.Hub,
	redis *redis.Client,
	db *sql.DB,
	store *repository.Store,
) *Handler {
	return &Handler{
		Auth:             auth,
		Keys:             keys,
		Message:          message,
		Audit:            audit,
		MetricsCollector: metricsCollector,
		Tokens:           tokens,
		Hub:              hub,
		Redis:            redis,
		DB:               db,
		Store:            store,
	}
}
