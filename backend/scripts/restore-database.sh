#!/bin/bash

###############################################################################
# Database Restore Script for KODA AI
# Supports both PostgreSQL (production) and SQLite (development)
#
# Usage:
#   ./restore-database.sh <backup-file>
#
# Examples:
#   ./restore-database.sh /var/backups/koda/koda-postgres-backup-20251011.sql.gz
#   ./restore-database.sh /var/backups/koda/koda-sqlite-backup-20251011.db.gz
#
# ⚠️  WARNING: This will OVERWRITE the current database!
#     Make sure to backup current data before restoring.
###############################################################################

# Check if backup file argument is provided
if [ -z "$1" ]; then
    echo "❌ Error: No backup file specified"
    echo ""
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Examples:"
    echo "  $0 /var/backups/koda/koda-postgres-backup-20251011.sql.gz"
    echo "  $0 /var/backups/koda/koda-sqlite-backup-20251011.db.gz"
    echo ""
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Database Restore"
echo "─────────────────────────────────────"
echo "Backup file: $BACKUP_FILE"
echo ""

# Load environment variables
if [ -f "$(dirname "$0")/../.env" ]; then
    export $(cat "$(dirname "$0")/../.env" | grep -v '^#' | xargs)
fi

# Detect database type from DATABASE_URL
if [[ "$DATABASE_URL" == *"postgresql"* ]] || [[ "$DATABASE_URL" == *"postgres"* ]]; then
    DB_TYPE="postgresql"
elif [[ "$DATABASE_URL" == *"sqlite"* ]] || [[ "$DATABASE_URL" == file:* ]]; then
    DB_TYPE="sqlite"
else
    echo "❌ Error: Unable to detect database type from DATABASE_URL"
    exit 1
fi

echo "Database type: $DB_TYPE"
echo ""

# Confirmation prompt
read -p "⚠️  WARNING: This will OVERWRITE the current database. Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo ""
echo "Starting restore..."

# Decompress if needed
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing backup..."
    TEMP_FILE="/tmp/koda-restore-$(date +%s)"

    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

    if [ $? -eq 0 ]; then
        RESTORE_FILE="$TEMP_FILE"
        echo "✅ Backup decompressed"
    else
        echo "❌ Error: Failed to decompress backup"
        exit 1
    fi
fi

###############################################################################
# PostgreSQL Restore
###############################################################################
if [ "$DB_TYPE" = "postgresql" ]; then
    # Parse PostgreSQL connection details
    if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"

        # Remove query parameters
        DB_NAME=$(echo "$DB_NAME" | cut -d'?' -f1)

        echo "Database: $DB_NAME"
        echo "Host: $DB_HOST"
        echo ""

        # Set password for psql
        export PGPASSWORD="$DB_PASS"

        # Drop and recreate database
        echo "Dropping existing database..."
        dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" --if-exists 2>/dev/null

        echo "Creating fresh database..."
        createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

        if [ $? -eq 0 ]; then
            echo "✅ Database recreated"
        else
            echo "❌ Error: Failed to create database"
            unset PGPASSWORD
            exit 1
        fi

        # Restore from backup
        echo "Restoring data from backup..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$RESTORE_FILE"

        if [ $? -eq 0 ]; then
            echo "✅ Database restored successfully"
        else
            echo "❌ Error: Database restore failed"
            unset PGPASSWORD
            exit 1
        fi

        # Cleanup password
        unset PGPASSWORD

    else
        echo "❌ Error: Unable to parse PostgreSQL connection string"
        exit 1
    fi

###############################################################################
# SQLite Restore
###############################################################################
elif [ "$DB_TYPE" = "sqlite" ]; then
    # Extract SQLite file path
    DB_FILE=$(echo "$DATABASE_URL" | sed 's|file:||' | sed 's|sqlite:||')

    # Resolve relative path
    if [[ "$DB_FILE" != /* ]]; then
        DB_FILE="$(dirname "$0")/../$DB_FILE"
    fi

    echo "Database file: $DB_FILE"
    echo ""

    # Backup current database before overwriting
    if [ -f "$DB_FILE" ]; then
        CURRENT_BACKUP="${DB_FILE}.before-restore-$(date +%s).bak"
        echo "Backing up current database to: $CURRENT_BACKUP"
        cp "$DB_FILE" "$CURRENT_BACKUP"
        echo "✅ Current database backed up"
        echo ""
    fi

    # Restore from backup
    echo "Restoring database..."
    cp "$RESTORE_FILE" "$DB_FILE"

    if [ $? -eq 0 ]; then
        echo "✅ Database restored successfully"
    else
        echo "❌ Error: Database restore failed"

        # Attempt to restore previous backup
        if [ -f "$CURRENT_BACKUP" ]; then
            echo "Attempting to restore previous database..."
            cp "$CURRENT_BACKUP" "$DB_FILE"
            echo "Previous database restored"
        fi

        exit 1
    fi
fi

# Cleanup temp file
if [ -n "$TEMP_FILE" ] && [ -f "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
fi

echo ""
echo "─────────────────────────────────────"
echo "✅ Database restore completed successfully!"
echo ""
echo "Next steps:"
echo "1. Run Prisma migrations if schema has changed:"
echo "   npx prisma migrate deploy"
echo ""
echo "2. Restart your application server"
echo ""

exit 0
