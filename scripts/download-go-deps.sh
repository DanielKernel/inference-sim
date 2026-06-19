#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ">> Downloading Go dependencies for platform module"
(
  cd "$ROOT"
  go mod download
)

if [[ -f "$ROOT/third_party/inference-sim/go.mod" ]]; then
  echo ">> Downloading Go dependencies for base module"
  (
    cd "$ROOT/third_party/inference-sim"
    go mod download
  )
fi

echo "Go dependency download complete."
