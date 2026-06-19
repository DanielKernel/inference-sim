#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p .bin

echo ">> Cleaning previous build artifacts"
rm -f .bin/apiserver .bin/apiserver.exe
rm -rf web/dist

"$ROOT/scripts/download-go-deps.sh"

echo ">> Building Go API server"
go build -mod=readonly -o .bin/apiserver ./apiserver

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
