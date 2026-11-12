#!/usr/bin/env bash
set -euo pipefail

# Back up every platform database and MinIO bucket.
# Usage: ./backup.sh /path/to/backup-dir

BACKUP_DIR="${1:-/var/backups/platform}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

DATABASES=(auth arkasodhara drawer "env-manager" portfolio "project-tracker")

for db in "${DATABASES[@]}"; do
  echo "dump $db"
  docker exec platform-postgres pg_dump -U "${POSTGRES_SUPERUSER:-platform}" -Fc "$db" \
    > "$BACKUP_DIR/${db// /_}-$STAMP.dump"
done

echo "sync minio"
mkdir -p "$BACKUP_DIR/minio"
docker run --rm --network "$(docker inspect platform-minio -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')" \
  --entrypoint mc \
  -v "$BACKUP_DIR:/backup" \
  -e MC_HOST_platform="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@platform-minio:9000" \
  bitnamilegacy/minio-client:latest mirror --overwrite --remove platform /backup/minio

echo "prune backups older than 14 days"
find "$BACKUP_DIR" -type f -mtime +14 -delete

echo "done: $BACKUP_DIR"
