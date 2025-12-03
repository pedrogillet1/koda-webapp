# 🚀 Koda VPS Deployment Guide

Complete step-by-step guide to deploy Koda on a production VPS with Ubuntu 22.04.

---

## 🎯 Prerequisites

Before you begin, ensure you have:

- ✅ Ubuntu 22.04 VPS (or similar Debian-based distro)
- ✅ Domain name pointing to your VPS IP (e.g., `app.yourdomain.com`)
- ✅ Root or sudo access to the VPS
- ✅ Minimum 2GB RAM, 2 CPU cores, 20GB storage
- ✅ GitHub repository access

**Required API Keys:**
- OpenAI API key
- Google Gemini API key
- AWS S3 credentials (for file storage)
- Pinecone API key (for vector embeddings)

---

## 📦 Step 1: Initial Server Setup

### SSH into your VPS

```bash
ssh root@your_vps_ip
# Or with a user account:
# ssh your_user@your_vps_ip
```

### Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Required Software

```bash
# Install Node.js v20.x (recommended for Koda)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x

# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Install Redis (for caching and background jobs)
sudo apt install -y redis-server

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Certbot (SSL certificates)
sudo apt install -y certbot python3-certbot-nginx

# Install Git (if not already installed)
sudo apt install -y git
```

---

## 🗄️ Step 2: Database Configuration

### Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user (run these commands in psql)
CREATE DATABASE koda_db;
CREATE USER koda_user WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE koda_db TO koda_user;

# Grant schema privileges (PostgreSQL 15+)
\c koda_db
GRANT ALL ON SCHEMA public TO koda_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO koda_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO koda_user;

# Exit psql
\q
```

### Configure PostgreSQL for Remote Access (Optional)

If your database is on a different server:

```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/15/main/postgresql.conf

# Find and modify:
listen_addresses = 'localhost'  # Change to '*' for remote access

# Edit pg_hba.conf for authentication
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Add this line:
host    koda_db    koda_user    0.0.0.0/0    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Configure Redis

```bash
# Start Redis and enable on boot
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping  # Should return PONG
```

---

## 📂 Step 3: Clone Repository & Install Dependencies

### Clone the Repository

```bash
# Clone to /var/www (recommended production location)
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/pedrogillet1/koda-webapp.git
sudo chown -R $USER:$USER koda-webapp
cd koda-webapp
```

### Install Backend Dependencies

```bash
cd backend
npm install --production

# Install development dependencies (needed for Prisma)
npm install prisma @prisma/client --save-dev
```

### Install Frontend Dependencies

```bash
cd ../frontend
npm install --production
```

---

## ⚙️ Step 4: Environment Configuration

### Backend Environment Variables

```bash
cd /var/www/koda-webapp/backend
cp .env.example .env
nano .env
```

**Complete `.env` configuration:**

```env
# ============================================================================
# KODA BACKEND ENVIRONMENT CONFIGURATION
# ============================================================================

# Node Environment
NODE_ENV=production
PORT=5001

# Database Configuration (PostgreSQL)
DATABASE_URL="postgresql://koda_user:your_strong_password@localhost:5432/koda_db?schema=public"
DIRECT_DATABASE_URL="postgresql://koda_user:your_strong_password@localhost:5432/koda_db?schema=public"

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_random_string
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars_different_random_string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (your domain)
FRONTEND_URL=https://app.yourdomain.com

# AI API Keys
OPENAI_API_KEY=sk-your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key

# AWS S3 Configuration (for file storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=koda-documents-prod

# Pinecone Configuration (vector database)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=koda-embeddings

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email Configuration (optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password

# Sentry Error Tracking (optional)
SENTRY_DSN=your-sentry-dsn

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload Limits
MAX_FILE_SIZE=104857600  # 100MB in bytes
```

### Frontend Environment Variables

```bash
cd /var/www/koda-webapp/frontend
nano .env.production
```

```env
REACT_APP_API_URL=https://app.yourdomain.com/api
REACT_APP_WS_URL=wss://app.yourdomain.com
```

---

## 🗃️ Step 5: Database Migration

### Run Prisma Migrations

```bash
cd /var/www/koda-webapp/backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify migration
npx prisma migrate status
```

### Seed Database (Optional)

If you have seed data:

```bash
npx prisma db seed
```

---

## 🏗️ Step 6: Build Applications

### Build Backend

```bash
cd /var/www/koda-webapp/backend
npm run build

# Verify build
ls -la dist/  # Should see compiled JavaScript files
```

### Build Frontend

```bash
cd /var/www/koda-webapp/frontend
npm run build

# Verify build
ls -la build/  # Should see optimized production files
```

---

## 🔧 Step 7: PM2 Process Management

### Create PM2 Ecosystem File

```bash
cd /var/www/koda-webapp
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'koda-backend',
      cwd: './backend',
      script: 'dist/server.js',  // or 'src/server.ts' if using ts-node
      instances: 2,  // Use 2 instances for load balancing
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### Start Applications with PM2

```bash
# Create logs directory
mkdir -p /var/www/koda-webapp/backend/logs

# Start backend
cd /var/www/koda-webapp
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Enable PM2 startup on boot
pm2 startup systemd
# Run the command that PM2 outputs

# Check status
pm2 status
pm2 logs koda-backend
```

---

## 🌐 Step 8: Nginx Configuration

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/koda
```

```nginx
# Upstream backend servers
upstream koda_backend {
    server localhost:5001;
}

# HTTP Server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name app.yourdomain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.yourdomain.com;

    # SSL Configuration (Certbot will add these)
    ssl_certificate /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/koda-access.log;
    error_log /var/log/nginx/koda-error.log;

    # Root directory for React frontend
    root /var/www/koda-webapp/frontend/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API Proxy
    location /api/ {
        proxy_pass http://koda_backend;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Support
    location /socket.io/ {
        proxy_pass http://koda_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # React Frontend - Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # File upload size limit
    client_max_body_size 100M;
}
```

### Enable Site and Test Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/koda /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If test passes, restart Nginx
sudo systemctl restart nginx
```

---

## 🔒 Step 9: SSL Certificate Setup

### Obtain Let's Encrypt SSL Certificate

```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Obtain certificate
sudo certbot certonly --standalone -d app.yourdomain.com

# Start Nginx
sudo systemctl start nginx

# Test auto-renewal
sudo certbot renew --dry-run
```

### Auto-Renewal Setup

Certbot automatically creates a systemd timer for renewal. Verify:

```bash
sudo systemctl status certbot.timer
```

---

## 🔥 Step 10: Firewall Configuration

### Configure UFW Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

---

## 🧪 Step 11: Testing & Verification

### Check All Services

```bash
# Check Nginx
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql

# Check Redis
sudo systemctl status redis-server

# Check PM2
pm2 status
pm2 logs koda-backend --lines 50
```

### Test Application

```bash
# Test backend health
curl http://localhost:5001/api/health

# Test HTTPS
curl https://app.yourdomain.com/api/health

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=app.yourdomain.com
```

---

## 📊 Step 12: Monitoring & Logging

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs koda-backend

# Check resource usage
pm2 info koda-backend
```

### System Monitoring

```bash
# Install htop
sudo apt install -y htop

# Monitor system resources
htop

# Check disk usage
df -h

# Check memory
free -h
```

---

## 🔄 Step 13: Deployment Updates

### Create Update Script

```bash
nano /var/www/koda-webapp/update.sh
chmod +x /var/www/koda-webapp/update.sh
```

```bash
#!/bin/bash

echo "🔄 Updating Koda Application..."

# Navigate to project directory
cd /var/www/koda-webapp

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Update backend
echo "🔧 Updating backend..."
cd backend
npm install --production
npm run build
npx prisma migrate deploy
npx prisma generate

# Update frontend
echo "🎨 Updating frontend..."
cd ../frontend
npm install --production
npm run build

# Restart PM2
echo "🔄 Restarting services..."
cd ..
pm2 restart all

echo "✅ Update complete!"
pm2 status
```

### Run Update

```bash
cd /var/www/koda-webapp
./update.sh
```

---

## 🚨 Troubleshooting

### Backend Won't Start

```bash
# Check logs
pm2 logs koda-backend --lines 100

# Check port availability
sudo netstat -tulpn | grep 5001

# Check environment variables
pm2 env 0
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U koda_user -d koda_db

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Nginx 502 Bad Gateway

```bash
# Check backend is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/koda-error.log

# Test backend directly
curl http://localhost:5001/api/health
```

---

## 🔐 Security Checklist

- ✅ Change all default passwords
- ✅ Use strong JWT secrets (minimum 32 characters)
- ✅ Enable UFW firewall
- ✅ Configure fail2ban for SSH protection
- ✅ Regular security updates (`sudo apt update && sudo apt upgrade`)
- ✅ Use environment variables (never commit secrets)
- ✅ Enable HTTPS with Let's Encrypt
- ✅ Configure proper CORS settings
- ✅ Set up database backups
- ✅ Monitor logs regularly

---

## 📦 Backup Strategy

### Database Backup Script

```bash
nano /var/www/koda-webapp/backup.sh
chmod +x /var/www/koda-webapp/backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/koda"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
pg_dump -U koda_user koda_db | gzip > $BACKUP_DIR/koda_db_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "koda_db_*.sql.gz" -mtime +7 -delete

echo "✅ Backup completed: koda_db_$DATE.sql.gz"
```

### Schedule Automated Backups

```bash
# Add to crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /var/www/koda-webapp/backup.sh
```

---

## 🎉 Deployment Complete!

Your Koda application is now deployed and running on your VPS!

**Access your application:**
- Frontend: https://app.yourdomain.com
- Backend API: https://app.yourdomain.com/api
- Health Check: https://app.yourdomain.com/api/health

**Useful Commands:**
```bash
pm2 status              # Check application status
pm2 logs koda-backend   # View application logs
pm2 restart all         # Restart all applications
sudo systemctl status nginx  # Check Nginx status
sudo certbot renew      # Renew SSL certificates
```

---

## 📚 Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Need Help?**
- Check logs: `pm2 logs` and `/var/log/nginx/`
- Monitor resources: `htop` and `pm2 monit`
- Test connectivity: `curl` commands

🚀 Happy Deploying!
