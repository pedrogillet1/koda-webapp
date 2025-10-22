#!/bin/bash

###############################################################################
# Database Backup Script for KODA AI
# Supports both PostgreSQL (production) and SQLite (development)
#
# Usage:
#   ./backup-database.sh [backup_dir]
#
# Setup:
#   1. Make executable: chmod +x backup-database.sh
#   2. Test manually: ./backup-database.sh
#   3. Add to crontab: crontab -e
#      0 2 * * * /path/to/webapp/backend/scripts/backup-database.sh
#
# Auto-cleanup: Deletes backups older than 30 days
###############################################################################

# Configuration
BACKUP_DIR="${1:-/var/backups/koda}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Load environment variables
if [ -f "$(dirname "$0")/../.env" ]; then
    export $(cat "$(dirname "$0")/../.env" | grep -v '^#' | xargs)
fi

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Detect database type from DATABASE_URL
if [[ "$DATABASE_URL" == *"postgresql"* ]] || [[ "$DATABASE_URL" == *"postgres"* ]]; then
    DB_TYPE="postgresql"
elif [[ "$DATABASE_URL" == *"sqlite"* ]] || [[ "$DATABASE_URL" == file:* ]]; then
    DB_TYPE="sqlite"
else
    echo "❌ Error: Unable to detect database type from DATABASE_URL"
    echo "DATABASE_URL: $DATABASE_URL"
    exit 1
fi

echo "📦 Starting database backup..."
echo "Database type: $DB_TYPE"
echo "Backup directory: $BACKUP_DIR"
echo "Date: $DATE"

###############################################################################
# PostgreSQL Backup
###############################################################################
if [ "$DB_TYPE" = "postgresql" ]; then
    # Parse PostgreSQL connection details from DATABASE_URL
    # Format: postgresql://user:password@host:port/database

    if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"

        # Remove query parameters from DB_NAME
        DB_NAME=$(echo "$DB_NAME" | cut -d'?' -f1)

        echo "Database: $DB_NAME"
        echo "Host: $DB_HOST"
        echo "Port: $DB_PORT"

        # Set password for pg_dump
        export PGPASSWORD="$DB_PASS"

        # Create backup
        BACKUP_FILE="$BACKUP_DIR/koda-postgres-backup-$DATE.sql"

        echo "Creating PostgreSQL backup..."
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --format=plain \
            --no-owner \
            --no-acl \
            --verbose \
            > "$BACKUP_FILE" 2>&1

        if [ $? -eq 0 ]; then
            echo "✅ Backup created: $BACKUP_FILE"

            # Compress backup
            echo "Compressing backup..."
            gzip "$BACKUP_FILE"

            if [ $? -eq 0 ]; then
                COMPRESSED_FILE="${BACKUP_FILE}.gz"
                BACKUP_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
                echo "✅ Backup compressed: $COMPRESSED_FILE (Size: $BACKUP_SIZE)"
            else
                echo "⚠️  Warning: Compression failed, keeping uncompressed backup"
            fi
        else
            echo "❌ Error: pg_dump failed"
            exit 1
        fi

        # Cleanup password
        unset PGPASSWORD

    else
        echo "❌ Error: Unable to parse PostgreSQL connection string"
        exit 1
    fi

###############################################################################
# SQLite Backup
###############################################################################
elif [ "$DB_TYPE" = "sqlite" ]; then
    # Extract SQLite file path from DATABASE_URL
    # Format: file:./prisma/test.db or sqlite:./prisma/test.db

    DB_FILE=$(echo "$DATABASE_URL" | sed 's|file:||' | sed 's|sqlite:||')

    # Resolve relative path
    if [[ "$DB_FILE" != /* ]]; then
        DB_FILE="$(dirname "$0")/../$DB_FILE"
    fi

    if [ ! -f "$DB_FILE" ]; then
        echo "❌ Error: SQLite database file not found: $DB_FILE"
        exit 1
    fi

    echo "Database file: $DB_FILE"

    # Create backup
    BACKUP_FILE="$BACKUP_DIR/koda-sqlite-backup-$DATE.db"

    echo "Creating SQLite backup..."
    cp "$DB_FILE" "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        echo "✅ Backup created: $BACKUP_FILE"

        # Compress backup
        echo "Compressing backup..."
        gzip "$BACKUP_FILE"

        if [ $? -eq 0 ]; then
            COMPRESSED_FILE="${BACKUP_FILE}.gz"
            BACKUP_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
            echo "✅ Backup compressed: $COMPRESSED_FILE (Size: $BACKUP_SIZE)"
        else
            echo "⚠️  Warning: Compression failed, keeping uncompressed backup"
        fi
    else
        echo "❌ Error: SQLite backup failed"
        exit 1
    fi
fi

###############################################################################
# Cleanup Old Backups
###############################################################################
echo ""
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."

find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null
find "$BACKUP_DIR" -name "*.db.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null
find "$BACKUP_DIR" -name "*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null
find "$BACKUP_DIR" -name "*.db" -mtime +$RETENTION_DAYS -delete 2>/dev/null

echo "✅ Cleanup completed"

###############################################################################
# Backup Summary
###############################################################################
echo ""
echo "📊 Backup Summary:"
echo "─────────────────────────────────────"
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "Total backups: $BACKUP_COUNT"
echo "Total size: $TOTAL_SIZE"
echo "Retention period: $RETENTION_DAYS days"
echo "─────────────────────────────────────"

# Log completion
echo "$(date): Backup completed successfully - $BACKUP_FILE" >> "$BACKUP_DIR/backup.log"

echo ""
echo "✅ Database backup completed successfully!"

###############################################################################
# Optional: Upload to Cloud Storage
###############################################################################
# Uncomment to enable automatic cloud backup

# AWS S3
# if command -v aws &> /dev/null; then
#     echo "Uploading to AWS S3..."
#     aws s3 cp "$COMPRESSED_FILE" "s3://your-bucket/backups/$(basename $COMPRESSED_FILE)"
#     echo "✅ Uploaded to S3"
# fi

# Google Cloud Storage
# if command -v gsutil &> /dev/null; then
#     echo "Uploading to Google Cloud Storage..."
#     gsutil cp "$COMPRESSED_FILE" "gs://your-bucket/backups/$(basename $COMPRESSED_FILE)"
#     echo "✅ Uploaded to GCS"
# fi

exit 0
