#!/bin/bash
# Run database migration to add missing columns to pods table

set -e

echo "🔧 Running database migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set, trying docker-compose connection..."
  
  # Try docker exec if postgres container exists
  if docker ps | grep -q iwanna-postgres; then
    echo "📦 Found postgres container, running migration..."
    docker exec -i iwanna-postgres psql -U iwanna -d iwanna_db < "$(dirname "$0")/migrate_add_pod_columns.sql"
    echo "✅ Migration completed!"
    exit 0
  else
    echo "❌ Error: DATABASE_URL not set and postgres container not found"
    echo "   Please set DATABASE_URL or start docker-compose services"
    exit 1
  fi
else
  # Use DATABASE_URL directly
  psql "$DATABASE_URL" -f "$(dirname "$0")/migrate_add_pod_columns.sql"
  echo "✅ Migration completed!"
fi

