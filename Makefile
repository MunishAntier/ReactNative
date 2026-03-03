SHELL := /bin/bash

run:
	cd backend && go run ./cmd/api

migrate:
	cd backend && go run ./cmd/api migrate

test:
	cd backend && go test ./...

e2e:
	cd backend && go run ./tests/e2e --base-url $${BASE_URL:-http://localhost:8080}

wsload:
	cd backend && go run ./tests/wsload --ws-url $${WS_URL:-ws://localhost:8080/v1/ws} --token "$$TOKEN" --receiver "$$RECEIVER" --clients $${CLIENTS:-50} --messages $${MESSAGES:-200}

wsload-auto:
	cd backend && BASE_URL=$${BASE_URL:-http://localhost:8080} WS_URL=$${WS_URL:-ws://localhost:8080/v1/ws} CLIENTS=$${CLIENTS:-50} MESSAGES=$${MESSAGES:-200} ./tests/wsload/run.sh

fmt:
	cd backend && gofmt -w $(shell find . -name '*.go')
