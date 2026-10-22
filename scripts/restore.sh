#!/usr/bin/env bash
# Restore a backup made by backup.sh. DESTRUCTIVE: replaces the current database contents and uploaded files.
#
#   ./scripts/restore.sh backups/db-20261020-103000.dump backups/uploads-20261020-103000.tar
set -euo pipefail

[ $# -eq 2 ] || { echo "usage: $0 <db.dump> <uploads.tar>" >&2; exit 2; }
DUMP="$1"; UPLOADS="$2"
[ -s "$DUMP" ] && [ -s "$UPLOADS" ] || { echo "backup files not found or empty" >&2; exit 2; }

cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
DB="${POSTGRES_DB:-ai_resume_db}"
USER_NAME="${POSTGRES_USER:-postgres}"

read -r -p "This REPLACES the database '$DB' and the uploaded files. Type 'restore' to continue: " answer
[ "$answer" = "restore" ] || { echo "aborted"; exit 1; }

# Stop writers so nothing changes mid-restore. The queue's state is in the database, so it comes back consistent.
docker compose stop backend frontend

echo "Restoring PostgreSQL..."
docker compose exec -T postgres pg_restore -U "$USER_NAME" -d "$DB" --clean --if-exists --no-owner < "$DUMP"

echo "Restoring uploaded resumes..."
docker compose run --rm --no-deps -T --entrypoint sh backend -c "rm -rf /data/uploads/* && tar -C /data -xf -" < "$UPLOADS"

docker compose start backend frontend
echo "Restored. Tasks that were mid-flight when the backup was taken resume automatically (their lease expires)."
echo "If vectors look out of date, re-index: see docs/OPERATIONS.md ('Rebuilding the vector index')."
