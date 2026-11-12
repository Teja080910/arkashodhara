#!/bin/sh
set -eu
case "${PLATFORM_APP:-api}" in
  auth) exec node /repo/apps/auth/dist/main.js ;;
  api) exec node /repo/apps/api/dist/main.js ;;
  *) echo "unknown PLATFORM_APP: ${PLATFORM_APP}" >&2; exit 1 ;;
esac
