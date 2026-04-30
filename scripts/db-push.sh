#!/usr/bin/env bash
# Run prisma db push using session pooler (DDL-capable) instead of transaction pooler
set -euo pipefail

# Load .env from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "Error: .env not found at $PROJECT_ROOT/.env" >&2
  exit 1
fi

# Parse MIGRATE_URL from .env (handles quoted/unquoted values, preserves $ in password)
MIGRATE_URL=$(grep -E '^MIGRATE_URL=' "$PROJECT_ROOT/.env" | head -1 | sed -E 's/^MIGRATE_URL=//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')

if [ -z "$MIGRATE_URL" ]; then
  echo "Error: MIGRATE_URL not set in .env" >&2
  echo "Add: MIGRATE_URL=postgresql://...:5432/postgres (Session pooler, port 5432)" >&2
  exit 1
fi

# Sanity check: must be port 5432 (session pooler), not 6543 (transaction)
if [[ "$MIGRATE_URL" != *":5432/"* ]]; then
  echo "Warning: MIGRATE_URL does not use port 5432 (session pooler). DDL may fail." >&2
fi

cd "$PROJECT_ROOT"

echo "→ Running prisma db push via session pooler..."
DATABASE_URL="$MIGRATE_URL" npx prisma db push "$@"

echo "→ Regenerating Prisma client..."
npx prisma generate

echo "✓ Done."
