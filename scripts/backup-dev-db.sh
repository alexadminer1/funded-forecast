#!/usr/bin/env bash
# scripts/backup-dev-db.sh
# Phase 0.9 — backup dev postgres before destructive operations.
#
# Two modes:
#   PRIMARY:  server-side via ssh ff-dev + docker exec (no SSH tunnel needed,
#             no network roundtrip, uses Docker internal network).
#   FALLBACK: local via SSH tunnel + pg_dump (requires tunnel on :15432).
#
# Password handling:
#   - PRIMARY: docker exec uses POSTGRES_PASSWORD baked into container env.
#   - FALLBACK: use PGPASSWORD env var or ~/.pgpass. Never inline in command.
#
# USAGE:
#   bash scripts/backup-dev-db.sh primary
#   bash scripts/backup-dev-db.sh fallback
#
# Default mode is primary if no arg given.

set -euo pipefail

MODE="${1:-primary}"
TIMESTAMP="$(date +%Y%m%d-%H%M)"
PG_CONTAINER="ku2yqi907qdi78bk3xb5zy3p"  # postgres-dev (Coolify UUID)

case "$MODE" in
  primary)
    REMOTE_DIR="/home/claude/backups"
    REMOTE_FILE="${REMOTE_DIR}/dev-db-pre-wipe-${TIMESTAMP}.sql"
    echo "Mode: PRIMARY (server-side via ssh ff-dev + docker exec)"
    echo "Target file on server: ${REMOTE_FILE}"

    ssh ff-dev "mkdir -p ${REMOTE_DIR} && \
      docker exec ${PG_CONTAINER} pg_dump -U postgres -d fundedforecast \
      > ${REMOTE_FILE} && \
      ls -lh ${REMOTE_FILE}"

    echo ""
    echo "Backup completed on server. Path: ${REMOTE_FILE}"
    echo "To copy to Mac (optional):"
    echo "  scp ff-dev:${REMOTE_FILE} /tmp/"
    ;;

  fallback)
    LOCAL_DIR="/tmp/ff-backups"
    LOCAL_FILE="${LOCAL_DIR}/dev-db-pre-wipe-${TIMESTAMP}.sql"
    mkdir -p "${LOCAL_DIR}"
    echo "Mode: FALLBACK (local via SSH tunnel on :15432)"
    echo "Prerequisite: ssh -L 15432:10.0.1.9:5432 ff-dev (in another shell)"
    echo "Password: via ~/.pgpass or PGPASSWORD env"
    echo "Target file: ${LOCAL_FILE}"
    echo ""

    if ! nc -z 127.0.0.1 15432 2>/dev/null; then
      echo "ERROR: tunnel not detected on 127.0.0.1:15432"
      echo "Open: ssh -L 15432:10.0.1.9:5432 ff-dev"
      exit 1
    fi

    pg_dump -h 127.0.0.1 -p 15432 -U postgres -d fundedforecast \
      > "${LOCAL_FILE}"

    SIZE="$(ls -lh "${LOCAL_FILE}" | awk '{print $5}')"
    echo "Backup completed. Path: ${LOCAL_FILE}  Size: ${SIZE}"
    ;;

  *)
    echo "Unknown mode: ${MODE}"
    echo "Usage: bash scripts/backup-dev-db.sh [primary|fallback]"
    exit 2
    ;;
esac

echo ""
echo "RESTORE (in case of disaster):"
echo "  primary:   ssh ff-dev 'docker exec -i ${PG_CONTAINER} \\"
echo "               psql -U postgres -d fundedforecast' < <backup>.sql"
echo "  fallback:  psql -h 127.0.0.1 -p 15432 -U postgres \\"
echo "               -d fundedforecast < <backup>.sql"
