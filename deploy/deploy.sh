#!/usr/bin/env bash
#
# Arkasodhara — one-command auto deploy (run ON the VPS, inside the repo).
#
# What it does:
#   1. pulls the latest main from origin
#   2. installs dependencies (npm ci, falls back to npm install)
#   3. builds the Next.js production bundle
#   4. reloads the PM2 process on its dedicated port (see ecosystem.config.js)
#   5. health-checks the running app
#
# Usage (on the server):
#   ./deploy/deploy.sh              # pull + install + build + reload
#   ./deploy/deploy.sh --no-pull    # skip git pull (deploy what is on disk)
#   PORT=3200 ./deploy/deploy.sh    # use a different port (update nginx too)
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="arkasodhara"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3117}"
PULL=1
[ "${1:-}" = "--no-pull" ] && PULL=0

cd "${APP_DIR}"

echo "==> Deploying ${APP_NAME} (branch: ${BRANCH}, port: ${PORT})"

# --- Pre-flight: make sure the port is free (or already held by our node app) ---
if command -v ss >/dev/null 2>&1; then
  OWNER="$(ss -ltnp 2>/dev/null | grep "[:.]${PORT} " || true)"
  if [ -n "${OWNER}" ] && ! echo "${OWNER}" | grep -q "node"; then
    echo "ERROR: port ${PORT} is already used by another app:"
    echo "${OWNER}"
    echo "Pick a free port, e.g.  PORT=3200 ./deploy/deploy.sh"
    exit 1
  fi
fi

if [ "${PULL}" = "1" ]; then
  echo "==> Pulling latest ${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
fi

echo "==> Installing dependencies"
npm ci || npm install

echo "==> Building production bundle"
npm run build

echo "==> Ensuring PM2 is available"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2 globally..."
  npm install -g pm2
fi

echo "==> Starting / reloading ${APP_NAME} with PM2"
PORT="${PORT}" pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "==> Health check"
for i in $(seq 1 15); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/"; then
    echo "    OK — app is responding on port ${PORT}"
    break
  fi
  if [ "${i}" = "15" ]; then
    echo "ERROR: app did not respond on port ${PORT}."
    echo "       Check: pm2 logs ${APP_NAME}"
    exit 1
  fi
  sleep 2
done

echo ""
echo "==> Deploy complete."
echo "    Status: pm2 status ${APP_NAME}"
echo "    Logs:   pm2 logs ${APP_NAME}"
echo ""
echo "==> First time on this server only: install the nginx site (see deploy/nginx.conf):"
echo "    sudo cp deploy/nginx.conf /etc/nginx/sites-available/arkasodhara"
echo "    sudo ln -sf /etc/nginx/sites-available/arkasodhara /etc/nginx/sites-enabled/"
echo "    sudo nginx -t && sudo systemctl reload nginx"
echo "    sudo certbot --nginx -d arkasodhara.in -d www.arkasodhara.in"
