#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
WS_URL="${WS_URL:-ws://localhost:8080/v1/ws}"
CLIENTS="${CLIENTS:-50}"
MESSAGES="${MESSAGES:-200}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install: sudo apt install jq"
  exit 1
fi

IDENT="loadtest$(date +%s)@example.com"
DEVICE="load-device-$(date +%s)"

OTP=$(curl -sS -X POST "$BASE_URL/v1/auth/start" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$IDENT\",\"purpose\":\"login\"}" | jq -r '.dev_otp')

if [[ -z "$OTP" || "$OTP" == "null" ]]; then
  echo "dev_otp missing; ensure backend is running with OTP_DEV_EXPOSE=true"
  exit 1
fi

AUTH=$(curl -sS -X POST "$BASE_URL/v1/auth/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$IDENT\",\"otp\":\"$OTP\",\"device_uuid\":\"$DEVICE\",\"platform\":\"load\"}")

TOKEN=$(echo "$AUTH" | jq -r '.access_token')
USER_ID=$(echo "$AUTH" | jq -r '.user_id')

if [[ -z "$TOKEN" || "$TOKEN" == "null" || -z "$USER_ID" || "$USER_ID" == "null" ]]; then
  echo "failed to obtain access token/user id"
  echo "$AUTH"
  exit 1
fi

echo "load user identifier: $IDENT"
echo "receiver user id: $USER_ID"

go run ./tests/wsload --ws-url "$WS_URL" --token "$TOKEN" --receiver "$USER_ID" --clients "$CLIENTS" --messages "$MESSAGES"
