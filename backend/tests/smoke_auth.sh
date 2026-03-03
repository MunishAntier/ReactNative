#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
IDENTIFIER="${IDENTIFIER:-user$(date +%s)@example.com}"
DEVICE_UUID="${DEVICE_UUID:-device-$(date +%s)}"
PLATFORM="${PLATFORM:-android}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required"
  exit 1
fi

echo "[1/3] start otp for $IDENTIFIER"
START_RESP=$(curl -sS -X POST "$BASE_URL/v1/auth/start" -H 'Content-Type: application/json' -d "{\"identifier\":\"$IDENTIFIER\",\"purpose\":\"login\"}")
OTP=$(echo "$START_RESP" | jq -r '.dev_otp')
if [[ -z "$OTP" || "$OTP" == "null" ]]; then
  echo "OTP not exposed; set OTP_DEV_EXPOSE=true in backend env"
  exit 1
fi

echo "[2/3] verify otp"
VERIFY_RESP=$(curl -sS -X POST "$BASE_URL/v1/auth/verify" -H 'Content-Type: application/json' -d "{\"identifier\":\"$IDENTIFIER\",\"otp\":\"$OTP\",\"device_uuid\":\"$DEVICE_UUID\",\"platform\":\"$PLATFORM\"}")
ACCESS_TOKEN=$(echo "$VERIFY_RESP" | jq -r '.access_token')
REFRESH_TOKEN=$(echo "$VERIFY_RESP" | jq -r '.refresh_token')

echo "[3/3] call /v1/me + refresh"
ME_RESP=$(curl -sS -X GET "$BASE_URL/v1/me" -H "Authorization: Bearer $ACCESS_TOKEN")
REFRESH_RESP=$(curl -sS -X POST "$BASE_URL/v1/auth/refresh" -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")

echo "Auth smoke test success"
echo "$ME_RESP" | jq '.'
echo "$REFRESH_RESP" | jq '{access_token, refresh_token}'
