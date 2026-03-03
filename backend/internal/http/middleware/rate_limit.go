package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func RateLimit(redis *redis.Client, scope string, limitPerMinute int) gin.HandlerFunc {
	if redis == nil || limitPerMinute <= 0 {
		return func(c *gin.Context) { c.Next() }
	}
	return func(c *gin.Context) {
		now := time.Now().UTC()
		minute := now.Format("200601021504")
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		identity := clientIdentity(c)
		key := fmt.Sprintf("rl:%s:%s:%s:%s", scope, c.Request.Method, path, minute+":"+identity)

		count, err := redis.Incr(c.Request.Context(), key).Result()
		if err == nil {
			if count == 1 {
				_ = redis.Expire(c.Request.Context(), key, 75*time.Second).Err()
			}
			remaining := limitPerMinute - int(count)
			if remaining < 0 {
				remaining = 0
			}
			c.Writer.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limitPerMinute))
			c.Writer.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
			if int(count) > limitPerMinute {
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error":      "rate limit exceeded",
					"scope":      scope,
					"request_id": CurrentRequestID(c),
				})
				return
			}
		}

		c.Next()
	}
}

func clientIdentity(c *gin.Context) string {
	if v, ok := c.Get(ctxUserIDKey); ok {
		if userID, ok := v.(int64); ok && userID > 0 {
			return fmt.Sprintf("u:%d", userID)
		}
	}
	return "ip:" + c.ClientIP()
}
