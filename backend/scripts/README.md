# 📦 Database Backup & Restore Scripts

Automated database backup and restore scripts for KODA AI platform.

Supports both **PostgreSQL** (production) and **SQLite** (development).

---

## 🚀 Quick Start

### 1. Make Scripts Executable

```bash
chmod +x backup-database.sh
chmod +x restore-database.sh
```

### 2. Test Backup Manually

```bash
# Backup to default location (/var/backups/koda)
./backup-database.sh

# Backup to custom location
./backup-database.sh /path/to/backup/directory
```

### 3. Set Up Automated Backups

Add to crontab for daily backups at 2 AM:

```bash
crontab -e

# Add this line:
0 2 * * * /path/to/webapp/backend/scripts/backup-database.sh
```

---

## 📋 Features

### Backup Script (`backup-database.sh`)

- ✅ **Auto-detection**: Automatically detects PostgreSQL or SQLite from `DATABASE_URL`
- ✅ **Compression**: Gzip compression to save disk space
- ✅ **Auto-cleanup**: Deletes backups older than 30 days
- ✅ **Logging**: Creates `backup.log` for audit trail
- ✅ **Cloud upload ready**: Commented code for AWS S3 / Google Cloud Storage

### Restore Script (`restore-database.sh`)

- ✅ **Safety**: Requires confirmation before overwriting
- ✅ **Auto-backup**: Backs up current database before restore (SQLite)
- ✅ **Decompression**: Handles `.gz` compressed backups automatically
- ✅ **Error recovery**: Attempts to restore previous backup if restore fails

---

## 📖 Usage Examples

### Backup

```bash
# Default backup
./backup-database.sh

# Custom backup directory
./backup-database.sh /mnt/backups/koda

# Check backup log
cat /var/backups/koda/backup.log
```

### Restore

```bash
# Restore from backup
./restore-database.sh /var/backups/koda/koda-postgres-backup-20251011_020000.sql.gz

# Restore SQLite backup
./restore-database.sh /var/backups/koda/koda-sqlite-backup-20251011_020000.db.gz
```

---

## 🔧 Configuration

### Backup Retention Period

Edit `backup-database.sh` and change:

```bash
RETENTION_DAYS=30  # Change to desired retention period
```

### Cloud Storage Upload

Uncomment the cloud storage section in `backup-database.sh`:

**AWS S3:**
```bash
aws s3 cp "$COMPRESSED_FILE" "s3://your-bucket/backups/$(basename $COMPRESSED_FILE)"
```

**Google Cloud Storage:**
```bash
gsutil cp "$COMPRESSED_FILE" "gs://your-bucket/backups/$(basename $COMPRESSED_FILE)"
```

---

## 📊 Backup File Naming

Backups are named with timestamp for easy identification:

- PostgreSQL: `koda-postgres-backup-YYYYMMDD_HHMMSS.sql.gz`
- SQLite: `koda-sqlite-backup-YYYYMMDD_HHMMSS.db.gz`

Example: `koda-postgres-backup-20251011_020000.sql.gz`

---

## 🛡️ Production Best Practices

### 1. Off-Site Backups

Always store backups in a different location from your database server:

```bash
# Upload to cloud storage after backup
./backup-database.sh && \
  aws s3 sync /var/backups/koda s3://your-bucket/backups/
```

### 2. Test Restores Regularly

Test your backups every month on a staging environment:

```bash
# Restore to staging database
./restore-database.sh /var/backups/koda/latest-backup.sql.gz
```

### 3. Monitor Backup Success

Set up alerting for backup failures:

```bash
# Add to backup script or monitoring system
if [ $? -ne 0 ]; then
    echo "Backup failed!" | mail -s "KODA Backup Failed" admin@yourdomain.com
fi
```

### 4. Multiple Backup Copies

Follow the 3-2-1 backup rule:
- **3** copies of data
- **2** different storage types
- **1** copy off-site

---

## 🚨 Recovery Scenarios

### Scenario 1: Accidental Data Deletion

```bash
# Restore from most recent backup
LATEST_BACKUP=$(ls -t /var/backups/koda/*.sql.gz | head -1)
./restore-database.sh "$LATEST_BACKUP"
```

### Scenario 2: Database Corruption

```bash
# 1. Stop application server
sudo systemctl stop koda-backend

# 2. Restore from backup
./restore-database.sh /var/backups/koda/koda-postgres-backup-20251011.sql.gz

# 3. Start application server
sudo systemctl start koda-backend
```

### Scenario 3: Server Migration

```bash
# On old server: Create backup
./backup-database.sh /tmp/migration-backup

# Transfer to new server
scp /tmp/migration-backup/*.sql.gz user@newserver:/tmp/

# On new server: Restore
./restore-database.sh /tmp/migration-backup/koda-postgres-backup-*.sql.gz
```

---

## ⚙️ Cron Schedule Examples

```bash
# Daily at 2 AM
0 2 * * * /path/to/backup-database.sh

# Every 6 hours
0 */6 * * * /path/to/backup-database.sh

# Every day at 2 AM, upload to S3
0 2 * * * /path/to/backup-database.sh && aws s3 sync /var/backups/koda s3://your-bucket/backups/

# Weekly on Sunday at 3 AM
0 3 * * 0 /path/to/backup-database.sh /var/backups/koda/weekly
```

---

## 🐛 Troubleshooting

### "pg_dump: command not found"

Install PostgreSQL client tools:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

### "Permission denied"

Make scripts executable:

```bash
chmod +x backup-database.sh
chmod +x restore-database.sh
```

### Backup directory not accessible

Create directory and set permissions:

```bash
sudo mkdir -p /var/backups/koda
sudo chown $USER:$USER /var/backups/koda
```

### "Unable to detect database type"

Check your `DATABASE_URL` in `.env`:

```bash
# Should be one of:
DATABASE_URL="postgresql://user:pass@localhost:5432/koda_db"
DATABASE_URL="file:./prisma/test.db"
```

---

## 📈 Monitoring Backup Health

Check backup statistics:

```bash
# List all backups
ls -lh /var/backups/koda/

# Count total backups
ls /var/backups/koda/*.gz | wc -l

# Total backup size
du -sh /var/backups/koda/

# View backup log
tail -f /var/backups/koda/backup.log
```

---

## 🔐 Security Considerations

1. **Encrypt backups** for sensitive data:
   ```bash
   gpg --encrypt --recipient admin@yourdomain.com backup.sql.gz
   ```

2. **Restrict permissions**:
   ```bash
   chmod 600 /var/backups/koda/*.gz
   ```

3. **Use separate backup user** (PostgreSQL):
   ```sql
   CREATE USER backup_user WITH PASSWORD 'secure_password';
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
   ```

---

## 📞 Support

For issues or questions, contact:
- **Technical Support:** support@kodapda.com
- **Emergency:** [Your emergency contact]

---

**Last Updated:** October 11, 2025
**Version:** 1.0
