#!/usr/bin/env bash
# Build-time config injection for static frontend deployment.
# Replaces the placeholder in config.js with the VITE_API_BASE env var.
# Usage: VITE_API_BASE=https://api.example.com ./scripts/build-config.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

API_BASE="${VITE_API_BASE:-}"

if [ -z "$API_BASE" ]; then
  echo "WARNING: VITE_API_BASE not set — config.js will use game.js localhost fallback"
  API_BASE=""
fi

# Remove trailing slash if present
API_BASE="${API_BASE%/}"

sed "s|__API_BASE_PLACEHOLDER__|${API_BASE}|g" \
  "$PROJECT_ROOT/config.js" > "$PROJECT_ROOT/config.js.tmp"
mv "$PROJECT_ROOT/config.js.tmp" "$PROJECT_ROOT/config.js"

echo "config.js updated: API_BASE=${API_BASE:-'(empty — localhost fallback)'}"
