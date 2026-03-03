# Secure E2EE Messaging Monorepo

Production-oriented 1:1 encrypted messaging scaffold with:
- Go + Gin backend (`backend/`)
- Native mobile module skeletons (`mobile/ios`, `mobile/android`)
- MySQL + Redis infra (`docker-compose.yml`)

## Implemented backend features
- OTP auth start/verify with Redis + rate limiting (prototype OTP delivery)
- Ed25519 JWT access tokens (15m) + refresh token rotation (30d)
- Device-bound sessions (`uid`, `did`, `sid` claims)
- Active session enforcement on authenticated REST + WS (revoked/logged-out sessions are blocked immediately, including active sockets)
- Signal public key management APIs
- Conversation listing + offline message sync
- WebSocket messaging (`message.send`, delivery/read acks, presence)
- Idempotent send using `(sender_id, client_message_id)` unique key
- 30-day retention worker
- Offline push wakeup hook via configurable notification provider (`noop` or `webhook`)
- Request IDs + route metrics (`/v1/metrics`) + Redis-backed abuse rate limiting

## Quick start
1. Copy `.env.example` to `.env` and adjust values.
2. Start dependencies:
   ```bash
   docker compose up -d mysql redis
   ```
3. Run migrations:
   ```bash
   make migrate
   ```
4. Run backend:
   ```bash
   make run
   ```
5. Optional integration checks:
   ```bash
   make e2e
   TOKEN=<access_token> RECEIVER=<receiver_user_id> make wsload
   make wsload-auto
   ```

## API base
- REST: `http://localhost:8080/v1`
- WS: `ws://localhost:8080/v1/ws`

## Notes
- End-to-end encryption is performed on clients. Server stores ciphertext only.
- Push wakeups support `noop` (default) or webhook provider wiring for prototype integrations.
- Native clients now include app-shell UI flows (Android + iOS) for OTP auth, key bootstrap, WS messaging, sync, and logout.
- Android now includes a real `libsignal-client` adapter path (with runtime fallback), while iOS still uses a placeholder `PlainSignal` bridge pending full native integration.
- Key bundle contract now includes `registration_id` (defaults to `1` when omitted for backward compatibility).

## Useful backend test helpers
- Auth smoke script: `backend/tests/smoke_auth.sh`
- WS load harness: `go run ./backend/tests/wsload --ws-url ws://localhost:8080/v1/ws --token <access_token> --receiver <user_id>`
- End-to-end flow harness: `go run ./backend/tests/e2e --base-url http://localhost:8080`
