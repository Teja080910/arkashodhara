#!/usr/bin/env bash
set -euo pipefail

# Renders deploy/env/*.env from deploy/env/*.env templates + deploy/.env.
# docker compose env_file does NOT interpolate variables, so we do it here.

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

if [ ! -f .env ]; then
  echo "deploy/.env missing. Copy deploy/env.example to deploy/.env and fill values." >&2
  exit 1
fi

# Read .env without executing it: values may contain spaces, pipes or $.
declare -A ENVVALS=()
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|'#'*) continue ;;
  esac
  key="${line%%=*}"
  value="${line#*=}"
  case "$key" in
    *[!A-Za-z0-9_]*|'') continue ;;
  esac
  # strip one layer of surrounding quotes and unescape " and \\
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}"; value="${value//\\\"/\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  export "$key=$value"
done < ./.env

mkdir -p env/rendered
echo "rendering env files -> deploy/env/rendered (values from deploy/.env)"
for f in env/*.env; do
  [ -e "$f" ] || continue
  envsubst < "$f" > "env/rendered/$(basename "$f")"
  echo "  rendered $f"
done
