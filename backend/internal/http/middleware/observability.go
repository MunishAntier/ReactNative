package middleware

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const ctxRequestIDKey = "request_id"

type metricKey struct {
	Method string
	Path   string
	Status int
}

type metricValue struct {
	Count int64
	Total time.Duration
	Max   time.Duration
}

type MetricsCollector struct {
	startedAt time.Time
	mu        sync.RWMutex
	metrics   map[metricKey]metricValue
}

type MetricsSnapshot struct {
	StartedAt string              `json:"started_at"`
	UptimeSec int64               `json:"uptime_sec"`
	Routes    []RouteMetricRecord `json:"routes"`
}

type RouteMetricRecord struct {
	Method       string  `json:"method"`
	Path         string  `json:"path"`
	Status       int     `json:"status"`
	Count        int64   `json:"count"`
	AvgLatencyMs float64 `json:"avg_latency_ms"`
	MaxLatencyMs float64 `json:"max_latency_ms"`
}

func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		startedAt: time.Now().UTC(),
		metrics:   make(map[metricKey]metricValue),
	}
}

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Set(ctxRequestIDKey, requestID)
		c.Writer.Header().Set("X-Request-ID", requestID)
		c.Next()
	}
}

func CurrentRequestID(c *gin.Context) string {
	if v, ok := c.Get(ctxRequestIDKey); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}

func Metrics(collector *MetricsCollector) gin.HandlerFunc {
	if collector == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		status := c.Writer.Status()
		collector.record(c.Request.Method, path, status, time.Since(start))
	}
}

func (m *MetricsCollector) Snapshot() MetricsSnapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()

	routes := make([]RouteMetricRecord, 0, len(m.metrics))
	for key, value := range m.metrics {
		avg := 0.0
		if value.Count > 0 {
			avg = float64(value.Total.Microseconds()) / 1000.0 / float64(value.Count)
		}
		routes = append(routes, RouteMetricRecord{
			Method:       key.Method,
			Path:         key.Path,
			Status:       key.Status,
			Count:        value.Count,
			AvgLatencyMs: avg,
			MaxLatencyMs: float64(value.Max.Microseconds()) / 1000.0,
		})
	}
	sort.Slice(routes, func(i, j int) bool {
		if routes[i].Path != routes[j].Path {
			return routes[i].Path < routes[j].Path
		}
		if routes[i].Method != routes[j].Method {
			return routes[i].Method < routes[j].Method
		}
		return routes[i].Status < routes[j].Status
	})

	now := time.Now().UTC()
	return MetricsSnapshot{
		StartedAt: m.startedAt.Format(time.RFC3339),
		UptimeSec: int64(now.Sub(m.startedAt).Seconds()),
		Routes:    routes,
	}
}

func (m *MetricsCollector) record(method, path string, status int, latency time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := metricKey{Method: method, Path: path, Status: status}
	current := m.metrics[key]
	current.Count++
	current.Total += latency
	if latency > current.Max {
		current.Max = latency
	}
	m.metrics[key] = current
}

func RenderPrometheus(snapshot MetricsSnapshot) string {
	var b strings.Builder
	b.WriteString("# HELP securemsg_process_uptime_seconds Process uptime in seconds.\n")
	b.WriteString("# TYPE securemsg_process_uptime_seconds gauge\n")
	b.WriteString(fmt.Sprintf("securemsg_process_uptime_seconds %d\n", snapshot.UptimeSec))

	b.WriteString("# HELP securemsg_http_requests_total Total HTTP requests.\n")
	b.WriteString("# TYPE securemsg_http_requests_total counter\n")
	for _, route := range snapshot.Routes {
		b.WriteString(fmt.Sprintf(
			"securemsg_http_requests_total{method=%q,path=%q,status=%q} %d\n",
			route.Method,
			route.Path,
			fmt.Sprintf("%d", route.Status),
			route.Count,
		))
	}

	b.WriteString("# HELP securemsg_http_request_latency_ms_avg Average request latency in milliseconds.\n")
	b.WriteString("# TYPE securemsg_http_request_latency_ms_avg gauge\n")
	for _, route := range snapshot.Routes {
		b.WriteString(fmt.Sprintf(
			"securemsg_http_request_latency_ms_avg{method=%q,path=%q,status=%q} %.3f\n",
			route.Method,
			route.Path,
			fmt.Sprintf("%d", route.Status),
			route.AvgLatencyMs,
		))
	}

	b.WriteString("# HELP securemsg_http_request_latency_ms_max Maximum request latency in milliseconds.\n")
	b.WriteString("# TYPE securemsg_http_request_latency_ms_max gauge\n")
	for _, route := range snapshot.Routes {
		b.WriteString(fmt.Sprintf(
			"securemsg_http_request_latency_ms_max{method=%q,path=%q,status=%q} %.3f\n",
			route.Method,
			route.Path,
			fmt.Sprintf("%d", route.Status),
			route.MaxLatencyMs,
		))
	}
	return b.String()
}
