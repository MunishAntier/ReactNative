package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func TestRateLimitByIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mini, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	defer mini.Close()

	redisClient := redis.NewClient(&redis.Options{Addr: mini.Addr()})
	defer redisClient.Close()

	r := gin.New()
	r.GET("/limited", RateLimit(redisClient, "test", 2), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	for i := 1; i <= 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/limited", nil)
		req.RemoteAddr = "10.1.1.1:12345"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if i <= 2 && w.Code != http.StatusOK {
			t.Fatalf("request %d expected 200 got %d", i, w.Code)
		}
		if i == 3 && w.Code != http.StatusTooManyRequests {
			t.Fatalf("request %d expected 429 got %d", i, w.Code)
		}
	}
}

func TestRateLimitByUserIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mini, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	defer mini.Close()

	redisClient := redis.NewClient(&redis.Options{Addr: mini.Addr()})
	defer redisClient.Close()

	r := gin.New()
	r.GET("/limited", func(c *gin.Context) {
		if c.Query("uid") == "1" {
			c.Set(ctxUserIDKey, int64(1))
		} else {
			c.Set(ctxUserIDKey, int64(2))
		}
		c.Next()
	}, RateLimit(redisClient, "test-authed", 1), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	firstU1 := httptest.NewRequest(http.MethodGet, "/limited?uid=1", nil)
	firstU1.RemoteAddr = "10.1.1.1:12345"
	firstU1Res := httptest.NewRecorder()
	r.ServeHTTP(firstU1Res, firstU1)
	if firstU1Res.Code != http.StatusOK {
		t.Fatalf("first user1 expected 200 got %d", firstU1Res.Code)
	}

	firstU2 := httptest.NewRequest(http.MethodGet, "/limited?uid=2", nil)
	firstU2.RemoteAddr = "10.1.1.1:12345"
	firstU2Res := httptest.NewRecorder()
	r.ServeHTTP(firstU2Res, firstU2)
	if firstU2Res.Code != http.StatusOK {
		t.Fatalf("first user2 expected 200 got %d", firstU2Res.Code)
	}

	secondU1 := httptest.NewRequest(http.MethodGet, "/limited?uid=1", nil)
	secondU1.RemoteAddr = "10.1.1.1:12345"
	secondU1Res := httptest.NewRecorder()
	r.ServeHTTP(secondU1Res, secondU1)
	if secondU1Res.Code != http.StatusTooManyRequests {
		t.Fatalf("second user1 expected 429 got %d", secondU1Res.Code)
	}

	keys := mini.Keys()
	if len(keys) == 0 {
		t.Fatalf("expected rate-limit keys in redis")
	}
	_, err = redisClient.Get(context.Background(), keys[0]).Result()
	if err != nil {
		t.Fatalf("read key from redis: %v", err)
	}
}
