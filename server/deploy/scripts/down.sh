#!/usr/bin/env bash
set -euo pipefail

# One-command stop for the whole stack.
#   ./scripts/down.sh          # stop and remove containers (keeps volumes/data)
#   ./scripts/down.sh --wipe   # also delete the database and uploads volumes

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.all.yml)

if [ "${1:-}" = "--wipe" ]; then
  echo "==> stopping and deleting volumes (destructive)"
  "${COMPOSE[@]}" down -v
else
  echo "==> stopping stack (volumes kept)"
  "${COMPOSE[@]}" down
fi

echo
"${COMPOSE[@]}" ps --format 'table {{.Name}}\t{{.Status}}' || true
