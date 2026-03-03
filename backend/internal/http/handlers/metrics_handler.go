package handlers

import (
	"net/http"

	"securemsg/backend/internal/http/middleware"

	"github.com/gin-gonic/gin"
)

func (h *Handler) Metrics(c *gin.Context) {
	if h.MetricsCollector == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "metrics collector unavailable"})
		return
	}
	c.JSON(http.StatusOK, h.MetricsCollector.Snapshot())
}

func (h *Handler) PrometheusMetrics(c *gin.Context) {
	if h.MetricsCollector == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "metrics collector unavailable"})
		return
	}
	snapshot := h.MetricsCollector.Snapshot()
	c.Data(http.StatusOK, "text/plain; version=0.0.4; charset=utf-8", []byte(middleware.RenderPrometheus(snapshot)))
}
