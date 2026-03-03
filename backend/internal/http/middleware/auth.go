package middleware

import (
	"context"
	"net/http"
	"strings"

	"securemsg/backend/internal/security"

	"github.com/gin-gonic/gin"
)

const (
	ctxUserIDKey    = "auth_user_id"
	ctxDeviceIDKey  = "auth_device_id"
	ctxSessionIDKey = "auth_session_id"
)

type SessionChecker func(ctx context.Context, userID, deviceID int64, sessionID string) (bool, error)

func AuthRequired(tokens *security.TokenManager, checkSession SessionChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			header = c.Query("token")
			if header != "" && !strings.HasPrefix(header, "Bearer ") {
				header = "Bearer " + header
			}
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		claims, err := tokens.ParseAccessToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid access token"})
			return
		}
		if checkSession != nil {
			active, checkErr := checkSession(c.Request.Context(), claims.UID, claims.DID, claims.SID)
			if checkErr != nil {
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "session validation unavailable"})
				return
			}
			if !active {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "session inactive"})
				return
			}
		}
		c.Set(ctxUserIDKey, claims.UID)
		c.Set(ctxDeviceIDKey, claims.DID)
		c.Set(ctxSessionIDKey, claims.SID)
		c.Next()
	}
}

func CurrentUserID(c *gin.Context) int64 {
	if v, ok := c.Get(ctxUserIDKey); ok {
		if id, ok := v.(int64); ok {
			return id
		}
	}
	return 0
}

func CurrentDeviceID(c *gin.Context) int64 {
	if v, ok := c.Get(ctxDeviceIDKey); ok {
		if id, ok := v.(int64); ok {
			return id
		}
	}
	return 0
}

func CurrentSessionID(c *gin.Context) string {
	if v, ok := c.Get(ctxSessionIDKey); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}
