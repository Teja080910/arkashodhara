#!/usr/bin/env bash
set -euo pipefail

# One-command start for the whole stack (infra + auth + 5 APIs + 5 frontends).
#   ./scripts/up.sh            # load env, build if needed, then start
#   ./scripts/up.sh --build    # force rebuild all images first
#   ./scripts/up.sh --fresh    # wipe volumes (DB + uploads) and start clean
#   ./scripts/up.sh --no-env   # skip pulling env from the Env Manager

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.all.yml)
BUILD=0
FRESH=0
LOAD_ENV=1
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=1 ;;
    --fresh) FRESH=1 ;;
    --no-env) LOAD_ENV=0 ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -f .env ]; then
  echo "deploy/.env missing. Copy env.example to .env and fill in the values:" >&2
  echo "  cp env.example .env" >&2
  exit 1
fi

if [ "$LOAD_ENV" = "1" ]; then
  if [ -n "${ENV_MANAGER_EMAIL:-}" ] || [ -n "${ENV_MANAGER_COOKIE:-}" ]; then
    echo "==> loading environment from Env Manager"
    ./scripts/load-env.sh || echo "warning: env load failed, using existing deploy/.env" >&2
  else
    echo "==> skipping Env Manager (set ENV_MANAGER_EMAIL/PASSWORD or ENV_MANAGER_COOKIE to enable)"
  fi
fi

echo "==> rendering env files"
./scripts/render-env.sh >/dev/null

if [ "$FRESH" = "1" ]; then
  echo "==> removing containers and volumes (destructive)"
  "${COMPOSE[@]}" down -v
fi

if [ "$BUILD" = "1" ]; then
  echo "==> building images"
  "${COMPOSE[@]}" build
fi

echo "==> starting stack"
"${COMPOSE[@]}" up -d

echo "==> waiting for health"
deadline=$((SECONDS + 180))
while [ $SECONDS -lt $deadline ]; do
  unhealthy=$("${COMPOSE[@]}" ps --format '{{.Name}} {{.Status}}' | grep -cE 'starting|unhealthy|Restarting' || true)
  if [ "$unhealthy" = "0" ]; then break; fi
  sleep 5
done

echo
"${COMPOSE[@]}" ps --format 'table {{.Name}}\t{{.Status}}'
echo
echo "APIs:      http://localhost:4100 (auth) + 4101-4105"
echo "Frontends: drawer :3002  portfolio :3010  pt :3005  env :3011  ark :3117"
