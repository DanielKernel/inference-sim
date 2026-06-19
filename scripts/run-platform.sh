#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDR="${ADDR:-:8080}"
URL="${URL:-http://localhost:8080}"

"$ROOT/scripts/build-platform.sh"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo ">> Starting platform server on $ADDR"
"$ROOT/.bin/apiserver" --addr "$ADDR" --data "$ROOT/data" --web-dir "$ROOT/web/dist" &
SERVER_PID=$!

echo ">> Waiting for server health check"
for _ in $(seq 1 40); do
  if curl -sf "$URL/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -sf "$URL/api/health" >/dev/null 2>&1; then
  echo "error: platform server failed to become healthy at $URL" >&2
  exit 1
fi

open_url() {
  if command -v open >/dev/null 2>&1; then
    open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 &
  elif command -v start >/dev/null 2>&1; then
    start "$1"
  else
    return 1
  fi
}

echo ">> Opening browser: $URL"
open_url "$URL" || echo "Open $URL manually in your browser."

echo
echo "Platform is running:"
echo "  Web UI: $URL"
echo "  API:    $URL/api/config"
echo
echo "Use Ctrl+C to stop."

wait "$SERVER_PID"
