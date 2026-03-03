package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"securemsg/backend/internal/config"
	apphttp "securemsg/backend/internal/http"
	"securemsg/backend/internal/platform"
	"securemsg/backend/internal/repository"
	"securemsg/backend/internal/worker"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := platform.OpenMySQL(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("mysql: %v", err)
	}
	defer db.Close()

	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		migrationsDir := filepath.Join("migrations")
		if err := platform.RunMigrations(db, migrationsDir); err != nil {
			log.Fatalf("migrations failed: %v", err)
		}
		log.Println("migrations applied")
		return
	}

	redisClient, err := platform.OpenRedis(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer redisClient.Close()

	if err := platform.RunMigrations(db, filepath.Join("migrations")); err != nil {
		log.Fatalf("run migrations on startup: %v", err)
	}

	app := apphttp.NewRouter(cfg, db, redisClient)
	repo := repository.NewStore(db)
	retentionWorker := worker.NewRetentionWorker(repo)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go retentionWorker.Start(ctx)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: app.Engine,
	}

	go func() {
		log.Printf("securemsg backend listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutdown requested")
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("server shutdown error: %v", err)
	}
}
