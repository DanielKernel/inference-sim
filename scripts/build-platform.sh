#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p .bin

echo ">> Building Go API server"
go build -o .bin/apiserver ./apiserver

echo ">> Building web app"
(
  cd web
  if [[ ! -d node_modules ]]; then
    npm install
  fi
  npm run build
)

echo
echo "Build complete:"
echo "  API: $ROOT/.bin/apiserver"
echo "  Web: $ROOT/web/dist"
