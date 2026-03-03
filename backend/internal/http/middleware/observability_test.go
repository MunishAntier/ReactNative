package middleware

import (
	"strings"
	"testing"
)

func TestRenderPrometheus(t *testing.T) {
	snapshot := MetricsSnapshot{
		StartedAt: "2026-02-28T00:00:00Z",
		UptimeSec: 42,
		Routes: []RouteMetricRecord{
			{
				Method:       "GET",
				Path:         "/v1/health",
				Status:       200,
				Count:        3,
				AvgLatencyMs: 1.5,
				MaxLatencyMs: 3.0,
			},
		},
	}

	output := RenderPrometheus(snapshot)
	checks := []string{
		"securemsg_process_uptime_seconds 42",
		"securemsg_http_requests_total{method=\"GET\",path=\"/v1/health\",status=\"200\"} 3",
		"securemsg_http_request_latency_ms_avg{method=\"GET\",path=\"/v1/health\",status=\"200\"} 1.500",
		"securemsg_http_request_latency_ms_max{method=\"GET\",path=\"/v1/health\",status=\"200\"} 3.000",
	}
	for _, check := range checks {
		if !strings.Contains(output, check) {
			t.Fatalf("missing expected metric line: %s", check)
		}
	}
}
