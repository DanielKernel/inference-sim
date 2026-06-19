#!/usr/bin/env bash
#
# update-base.sh — refresh the vendored BLIS base under third_party/inference-sim
# from the upstream inference-sim repository.
#
# The base is an isolated, independently-updatable module. Because it lives in a
# subdirectory (not the repo root), upstream is synced into that PREFIX rather
# than via a root-level `git merge`. This script performs a clean overlay sync:
# it fetches the requested upstream ref and replaces the prefix contents, leaving
# all extension code (apiserver/, library/, web/, data/, docs/) untouched.
#
# Usage:
#   scripts/update-base.sh [UPSTREAM_URL] [REF]
#
# Defaults:
#   UPSTREAM_URL=https://github.com/inference-sim/inference-sim.git
#   REF=main
#
# Alternatives (see docs/UPSTREAM-DELTAS.md): git subtree or git submodule.

set -euo pipefail

PREFIX="third_party/inference-sim"
UPSTREAM_URL="${1:-https://github.com/inference-sim/inference-sim.git}"
REF="${2:-main}"

# Run from repo root.
cd "$(git rev-parse --show-toplevel)"

if [[ ! -d "$PREFIX" ]]; then
  echo "error: $PREFIX does not exist; are you in the platform repo?" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: working tree has uncommitted changes; commit or stash first." >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "error: rsync is required." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo ">> Cloning upstream $UPSTREAM_URL @ $REF"
git clone --depth 1 --branch "$REF" "$UPSTREAM_URL" "$TMP/base"
NEW_SHA="$(git -C "$TMP/base" rev-parse HEAD)"
rm -rf "$TMP/base/.git"

echo ">> Overlaying into $PREFIX (extension code is outside the prefix and untouched)"
rsync -a --delete "$TMP/base/" "$PREFIX/"

echo ">> Verifying builds"
( cd "$PREFIX" && go build ./... )
go build ./...

cat <<EOF

Base synced to upstream $REF ($NEW_SHA).

Next:
  1. Review:  git status && git diff --stat
  2. Test:    (cd $PREFIX && go test ./...) && go test ./...
  3. If anything in the core-file delta ledger (docs/UPSTREAM-DELTAS.md) needed
     re-applying, do it now and update the ledger.
  4. Commit:  git add -A && git commit -m "chore(base): sync inference-sim @ $REF ($NEW_SHA)"
EOF
