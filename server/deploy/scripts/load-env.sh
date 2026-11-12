#!/usr/bin/env bash
# Load project environment variables from the Env Manager into deploy/.env.
#
# The Env Manager (default https://env.arkasodhara.tech) is the source of truth
# for per-project configuration. This pulls the projects this stack needs and
# merges the values into deploy/.env, then re-renders env/rendered/*.env.
#
# Usage:
#   ./scripts/load-env.sh                     # local stack
#   ./scripts/load-env.sh --env production    # production URLs
#   ./scripts/load-env.sh --dry-run           # show changes, write nothing
#   ./scripts/load-env.sh --only drawer,portfolio
#
# Credentials (required, never commit):
#   ENV_MANAGER_EMAIL, ENV_MANAGER_PASSWORD   or   ENV_MANAGER_COOKIE
# Optional:
#   ENV_MANAGER_URL      default https://env.arkasodhara.tech
#   ENV_MANAGER_VERIFY_TLS=1  verify the TLS certificate (default off)
set -euo pipefail

cd "$(dirname "$0")/.."

BASE="${ENV_MANAGER_URL:-https://env.arkasodhara.tech}"
BASE="${BASE%/}"
TARGET_ENV="local"
ONLY=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --env) TARGET_ENV="${2:?--env needs a value}"; shift 2 ;;
    --only) ONLY="${2:?--only needs a value}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --url) BASE="${2:?--url needs a value}"; BASE="${BASE%/}"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$TARGET_ENV" in
  local) BE_SUFFIX="be-local"; FE_SUFFIX="fe-local"; EXPECT_KEY="GOOGLE_CLIENT_ID" ;;
  production) BE_SUFFIX="be-production"; FE_SUFFIX="fe-production"; EXPECT_KEY="GOOGLE_CLIENT_ID" ;;
  *) echo "error: --env must be local or production" >&2; exit 2 ;;
esac

INSECURE=(-k)
if [ "${ENV_MANAGER_VERIFY_TLS:-0}" = "1" ]; then INSECURE=(); fi

WORK="$(mktemp -d)"
COOKIE_JAR="$WORK/cookies.txt"
trap 'rm -rf "$WORK"' EXIT

api() { curl -sS "${INSECURE[@]}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$@"; }

echo "==> authenticating against $BASE"
if [ -n "${ENV_MANAGER_COOKIE:-}" ]; then
  printf '%s\n' "$ENV_MANAGER_COOKIE" > "$COOKIE_JAR.raw"
  # accept either "em_session=..." or just the raw value
  cookie_value="${ENV_MANAGER_COOKIE#em_session=}"
  domain_host="${BASE#https://}"; domain_host="${domain_host%%/*}"
  cat > "$COOKIE_JAR" <<COOKIES
# Netscape HTTP Cookie File
$domain_host	FALSE	/	TRUE	0	em_session	$cookie_value
COOKIES
else
  if [ -z "${ENV_MANAGER_EMAIL:-}" ] || [ -z "${ENV_MANAGER_PASSWORD:-}" ]; then
    echo "error: set ENV_MANAGER_EMAIL and ENV_MANAGER_PASSWORD (or ENV_MANAGER_COOKIE)" >&2
    exit 2
  fi
  STATUS=$(api -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    --data "$(printf '{"email":"%s","password":"%s"}' "$ENV_MANAGER_EMAIL" "$ENV_MANAGER_PASSWORD")" \
    "$BASE/api/auth/login")
  if [ "$STATUS" != "200" ]; then
    echo "error: login failed (HTTP $STATUS)" >&2
    exit 2
  fi
fi

IDENTITY=$(api "$BASE/api/auth/me" | sed -n 's/.*"email":"\([^"]*\)".*/\1/p')
echo "    signed in as ${IDENTITY:-unknown}"

declare -A PROJECT_BE=( [arkasodhara-server]=1 [arkasodhara]=0 [drawer]=1 [portfolio]=1 [project-tracker]=1 [env-manager]=1 )
declare -A PROJECT_FE=( [arkasodhara-server]=0 [arkasodhara]=1 [drawer]=1 [portfolio]=1 [project-tracker]=1 [env-manager]=1 )

if [ -n "$ONLY" ]; then
  declare -A KEEP=()
  IFS=',' read -ra PARTS <<< "$ONLY"
  for part in "${PARTS[@]}"; do KEEP[$(echo "$part" | xargs)]=1; done
else
  declare -A KEEP=()
  for project in "${!PROJECT_BE[@]}"; do KEEP[$project]=1; done
fi

OUT="$WORK/vars.tsv"
: > "$OUT"

load_env() {
  project="$1"; env_name="$2"
  json=$(api "$BASE/api/projects/$project/envs/$env_name")
  if printf '%s' "$json" | grep -q '"error"'; then
    echo "    $project/$env_name: not found" >&2
    return 0
  fi
  count=$(printf '%s' "$json" | grep -o '"key":' | wc -l | tr -d ' ' || true)
  count=${count:-0}
  echo "    $project/$env_name: $count vars"
  printf '%s' "$json" | python3 -c '
import json, sys
data = json.load(sys.stdin)
for entry in data.get("variables", []):
    key = entry.get("key", "")
    value = entry.get("value") or ""
    print(key + "\t" + value)
' >> "$OUT"
}

echo "==> loading variables ($TARGET_ENV)"
for project in arkasodhara-server arkasodhara drawer portfolio project-tracker env-manager; do
  [ -n "${KEEP[$project]:-}" ] || continue
  if [ "${PROJECT_BE[$project]}" = "1" ]; then load_env "$project" "$BE_SUFFIX"; fi
  if [ "${PROJECT_FE[$project]}" = "1" ]; then load_env "$project" "$FE_SUFFIX"; fi
done

if [ ! -s "$OUT" ]; then
  echo "error: Env Manager returned no variables" >&2
  exit 1
fi

echo "==> merging into deploy/.env"
python3 - "$OUT" "$DRY_RUN" <<'PY'
import sys
from pathlib import Path

vars_path, dry_run = sys.argv[1], sys.argv[2] == "1"
env_file = Path(".env")

SKIP = {
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_PASSWORD",
    "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET",
    "ADMIN_AUTH_SECRET", "ADMIN_CREDENTIALS",
}
PROTECTED = {
    "POSTGRES_SUPERUSER", "POSTGRES_SUPERPASSWORD",
    "MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD",
    "DRAWER_S3_USER", "DRAWER_S3_PASSWORD",
    "PORTFOLIO_S3_USER", "PORTFOLIO_S3_PASSWORD",
    "PT_S3_USER", "PT_S3_PASSWORD",
    "INTERNAL_SERVICE_TOKEN", "AUTH_SECRET",
}
RENAME = {"AUTH_BASE_URL": "AUTH_PUBLIC_URL"}

collected, skipped = {}, set()
for raw in Path(vars_path).read_text().splitlines():
    if "\t" not in raw:
        continue
    key, _, value = raw.partition("\t")
    if key in SKIP or key.startswith("SUPABASE_"):
        skipped.add(key)
        continue
    key = RENAME.get(key, key)
    if key in PROTECTED:
        skipped.add(key)
        continue
    collected[key] = value

lines = env_file.read_text().splitlines() if env_file.exists() else []
index = {}
for position, raw in enumerate(lines):
    stripped = raw.strip()
    if not stripped or stripped.startswith("#") or "=" not in raw:
        continue
    index[raw.partition("=")[0].strip()] = position

def quote(value: str) -> str:
    if any(char in value for char in " \t#$`\\\"'|"):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return value

changed, added = [], []
for key, value in collected.items():
    rendered = f"{key}={quote(value)}"
    if key in index:
        position = index[key]
        if lines[position] != rendered:
            lines[position] = rendered
            changed.append(key)
    else:
        lines.append(rendered)
        index[key] = len(lines) - 1
        added.append(key)

print(f"    loaded {len(collected)} variables")
if added:
    print(f"    added:   {', '.join(sorted(added))}")
if changed:
    print(f"    updated: {', '.join(sorted(changed))}")
if skipped:
    print(f"    skipped: {', '.join(sorted(skipped))}")
if not added and not changed:
    print("    already up to date")

if dry_run:
    print("    (dry run, nothing written)")
    raise SystemExit(0)

env_file.write_text("\n".join(lines) + "\n")
PY

if [ "$DRY_RUN" = "1" ]; then
  exit 0
fi

echo "==> rendering compose env files"
./scripts/render-env.sh >/dev/null
echo "done. Run ./scripts/up.sh to start the stack."
