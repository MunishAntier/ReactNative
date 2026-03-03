package handlers

import "github.com/gin-gonic/gin"

func (h *Handler) audit(c *gin.Context, eventType string, userID *int64, deviceID *int64, metadata any) {
	if h.Audit == nil {
		return
	}
	_ = h.Audit.Log(c.Request.Context(), userID, deviceID, eventType, metadata)
}

func int64Ptr(v int64) *int64 {
	if v == 0 {
		return nil
	}
	return &v
}
