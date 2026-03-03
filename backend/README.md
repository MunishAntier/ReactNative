# Backend API (Go + Gin)

## Commands
- Run API: `go run ./cmd/api`
- Run migrations: `go run ./cmd/api migrate`
- Test: `go test ./...`
- WS load test:
  `go run ./tests/wsload --ws-url ws://localhost:8080/v1/ws --token <access_token> --receiver <user_id> --clients 50 --messages 200`
- WS load test (auto-generate token/user; no placeholders):
  `./tests/wsload/run.sh`
- Full E2E flow test (requires running backend + `OTP_DEV_EXPOSE=true`):
  `go run ./tests/e2e --base-url http://localhost:8080`

## Environment
See `/data/ReactNative/.env.example`.

Push wakeup options:
- `PUSH_PROVIDER=noop|webhook` (default `noop`)
- `PUSH_WEBHOOK_URL=https://...` for webhook mode
- `PUSH_WEBHOOK_AUTH_HEADER=Bearer ...` (optional)
- `PUSH_REQUEST_TIMEOUT=5s`

## Endpoint summary
- `POST /v1/auth/start`
- `POST /v1/auth/verify`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `GET /v1/metrics`
- `GET /v1/metrics/prometheus`
- `GET /v1/users/lookup?identifier=`
- `POST /v1/keys/upload`
- `POST /v1/keys/signed-prekey/rotate`
- `POST /v1/keys/one-time-prekeys/upload`
- `GET /v1/keys/:user_id`
- `GET /v1/conversations`
- `GET /v1/messages/sync?since=<RFC3339>&limit=<n>`
- `POST /v1/messages/:id/read`
- `GET /v1/ws?token=<access_token>`

## WebSocket events
Client -> server:
- `message.send`
- `message.ack.delivered`
- `message.ack.read`
- `presence.ping`

Server -> client:
- `message.new`
- `message.status`
- `prekeys.low`
- `session.identity_changed`

## Observability + Abuse controls
- Request IDs are attached as `X-Request-ID`.
- In-process request metrics are exposed at `GET /v1/metrics`.
- Prometheus-format metrics are exposed at `GET /v1/metrics/prometheus`.
- Request logs are emitted as structured JSON.
- Redis-backed route-level rate limiting is enabled with per-endpoint policies for auth/ws/keys/sync/read.
- Rate-limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
- Security/audit events are persisted in `audit_events` (auth lifecycle, key operations, ws connect/send failures, identity changes).
- Authenticated REST routes and WS require an active, non-revoked session (`sid`) in addition to a valid access JWT (including already-open WS connections on subsequent events).
