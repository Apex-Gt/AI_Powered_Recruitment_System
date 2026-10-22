#!/usr/bin/env bash
# Back up everything that cannot be rebuilt: the PostgreSQL database and the uploaded resume files.
# (Qdrant vectors and Ollama models are derived data: re-index / re-pull after a restore. See docs/OPERATIONS.md.)
#
#   ./scripts/backup.sh [output-dir]        default: ./backups
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

# Read the DB name/user the stack was started with (same defaults as docker-compose.yml).
set -a; [ -f .env ] && . ./.env; set +a
DB="${POSTGRES_DB:-ai_resume_db}"
USER_NAME="${POSTGRES_USER:-postgres}"

echo "Dumping PostgreSQL ($DB)..."
docker compose exec -T postgres pg_dump -U "$USER_NAME" -d "$DB" -Fc --no-owner > "$OUT/db-$STAMP.dump"

echo "Archiving uploaded resumes..."
docker compose exec -T backend tar -C /data -cf - uploads > "$OUT/uploads-$STAMP.tar"

# A zero-byte file means the command failed quietly; never leave one that looks like a good backup.
for f in "$OUT/db-$STAMP.dump" "$OUT/uploads-$STAMP.tar"; do
  [ -s "$f" ] || { echo "ERROR: $f is empty, backup failed" >&2; rm -f "$f"; exit 1; }
done

echo "Done:"
ls -lh "$OUT/db-$STAMP.dump" "$OUT/uploads-$STAMP.tar"
echo "Copy these off the machine. A backup on the same disk does not survive the disk."
