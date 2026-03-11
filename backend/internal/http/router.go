package http

import (
	"database/sql"

	"securemsg/backend/internal/config"
	"securemsg/backend/internal/http/handlers"
	"securemsg/backend/internal/http/middleware"
	"securemsg/backend/internal/notifications"
	"securemsg/backend/internal/repository"
	"securemsg/backend/internal/security"
	"securemsg/backend/internal/service"
	"securemsg/backend/internal/ws"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type App struct {
	Engine *gin.Engine
	Hub    *ws.Hub
}

func NewRouter(cfg *config.Config, db *sql.DB, redis *redis.Client) *App {
	gin.SetMode(gin.ReleaseMode)
	if cfg.AppEnv == "development" {
		gin.SetMode(gin.DebugMode)
	}
	r := gin.New()
	metricsCollector := middleware.NewMetricsCollector()
	r.Use(gin.Recovery(), middleware.RequestID(), middleware.Metrics(metricsCollector), middleware.RequestLogger())

	store := repository.NewStore(db)
	tokenManager := security.NewTokenManager(cfg.JWTIssuer, cfg.JWTPrivateKey, cfg.JWTPublicKey, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	hub := ws.NewHub()
	otpService := service.NewOTPService(redis, cfg.OTPTTL, cfg.OTPMaxAttempts, cfg.RateLimitPerMinute)
	authService := service.NewAuthService(store, otpService, tokenManager, cfg.OTPDevExpose)
	auditService := service.NewAuditService(store)
	keyService := service.NewKeyService(
		store,
		cfg.PreKeyLowThreshold,
		func(userID int64) {
			handlers.NotifyLowPrekeys(hub, userID)
		},
		func(targetUserID int64, changedUserID int64, identityKeyVersion int) {
			handlers.NotifyIdentityChanged(hub, targetUserID, changedUserID, identityKeyVersion)
		},
		hub.PreferredDeviceID,
	)
	pushService := notifications.BuildService(
		store,
		cfg.PushProvider,
		cfg.PushWebhookURL,
		cfg.PushWebhookAuthHeader,
		cfg.PushRequestTimeout,
	)
	messageService := service.NewMessageService(store, hub, pushService, cfg.MessageRetentionDays)
	h := handlers.New(authService, keyService, messageService, auditService, metricsCollector, tokenManager, hub, redis, db)

	v1 := r.Group("/v1")
	v1.GET("/health", h.Health)
	v1.GET("/metrics", h.Metrics)
	v1.GET("/metrics/prometheus", h.PrometheusMetrics)
	v1.POST("/auth/start", middleware.RateLimit(redis, "auth_start", cfg.RateLimitAuthStartPerMinute), h.AuthStart)
	v1.POST("/auth/verify", middleware.RateLimit(redis, "auth_verify", cfg.RateLimitAuthVerifyPerMinute), h.AuthVerify)
	v1.POST("/auth/refresh", middleware.RateLimit(redis, "auth_refresh", cfg.RateLimitAuthRefreshPerMinute), h.AuthRefresh)
	v1.GET("/ws", middleware.RateLimit(redis, "ws_connect", cfg.RateLimitWSConnectPerMinute), h.WebSocket)

	authed := v1.Group("")
	authed.Use(middleware.AuthRequired(tokenManager, authService.IsSessionActive), middleware.RateLimit(redis, "authed", cfg.RateLimitAuthedPerMinute))
	authed.POST("/auth/logout", h.AuthLogout)
	authed.GET("/me", h.Me)
	authed.GET("/users/lookup", h.UsersLookup)
	authed.POST("/keys/upload", h.UploadKeys)
	authed.POST("/keys/signed-prekey/rotate", h.RotateSignedPrekey)
	authed.POST("/keys/one-time-prekeys/upload", h.UploadOneTimePrekeys)
	authed.GET("/keys/prekey-count", h.GetPreKeyCount)
	authed.GET("/keys/:user_id", middleware.RateLimit(redis, "keys_fetch", cfg.RateLimitKeysFetchPerMinute), h.GetKeyBundle)
	authed.GET("/conversations", h.ListConversations)
	authed.GET("/messages/sync", middleware.RateLimit(redis, "messages_sync", cfg.RateLimitMessagesSyncPerMinute), h.SyncMessages)
	authed.POST("/messages/:id/read", middleware.RateLimit(redis, "message_read", cfg.RateLimitMessageReadPerMinute), h.MarkMessageRead)

	return &App{Engine: r, Hub: hub}
}
