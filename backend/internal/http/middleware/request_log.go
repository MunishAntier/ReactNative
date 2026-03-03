package middleware

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		entry := map[string]any{
			"ts":         time.Now().UTC().Format(time.RFC3339Nano),
			"level":      "info",
			"request_id": CurrentRequestID(c),
			"method":     c.Request.Method,
			"path":       path,
			"status":     c.Writer.Status(),
			"latency_ms": float64(time.Since(start).Microseconds()) / 1000.0,
			"client_ip":  c.ClientIP(),
			"user_agent": c.Request.UserAgent(),
			"bytes_out":  c.Writer.Size(),
		}
		if v, ok := c.Get(ctxUserIDKey); ok {
			if userID, ok := v.(int64); ok && userID > 0 {
				entry["user_id"] = userID
			}
		}
		if len(c.Errors) > 0 {
			entry["errors"] = c.Errors.String()
		}

		encoded, err := json.Marshal(entry)
		if err != nil {
			log.Printf("{\"level\":\"error\",\"msg\":\"request log marshal failed\",\"err\":%q}", err.Error())
			return
		}
		log.Print(string(encoded))
	}
}
