# Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [Production Configuration](#production-configuration)
6. [Monitoring and Logging](#monitoring-and-logging)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

| Service | Version | Purpose |
|---------|---------|---------|
| Node.js | 18+ | Runtime |
| PostgreSQL | 14+ | Database |
| Redis | 6+ | Message Queue |
| MinIO or S3 | Latest | Object Storage |

### Optional Services

| Service | Purpose |
|---------|---------|
| Docker | Containerization |
| Docker Compose | Local orchestration |
| Nginx | Reverse proxy |
| PM2 | Process management |

---

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/kevin-claw-agent/content-pipeline.git
cd content-pipeline
npm install
```

### 2. Environment Variables

Create `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/content_pipeline

# Redis
REDIS_URL=redis://localhost:6379

# Storage (MinIO or S3)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=content-pipeline
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# AWS S3 (if not using MinIO)
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
# AWS_REGION=us-east-1

# LLM API
OPENAI_API_KEY=your-openai-key

# Server
PORT=3000
NODE_ENV=production
```

See `.env.example` for all options.

### 3. Database Setup

```bash
# Create database
createdb content_pipeline

# Run migrations
psql -d content_pipeline -f schema.sql
```

---

## Docker Deployment

### Quick Start (Development)

```bash
# Start all services
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# Stop services
docker-compose -f docker/docker-compose.yml down
```

### Production Docker Setup

```bash
# Build image
docker build -t content-pipeline:latest -f docker/Dockerfile .

# Run with environment
docker run -d \
  --name content-pipeline-api \
  -p 3000:3000 \
  --env-file .env \
  --link postgres \
  --link redis \
  --link minio \
  content-pipeline:latest

# Run workers
docker run -d \
  --name content-pipeline-workers \
  --env-file .env \
  content-pipeline:latest \
  npm run workers
```

### Docker Compose Production

```yaml
version: '3.8'

services:
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/content_pipeline
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
      - minio
    restart: unless-stopped

  workers:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: npm run workers
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/content_pipeline
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 2

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=content_pipeline
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## Manual Deployment

### 1. Database Setup

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE content_pipeline;"
sudo -u postgres psql -c "CREATE USER pipeline_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE content_pipeline TO pipeline_user;"

# Run schema
psql -d content_pipeline -f schema.sql
```

### 2. Redis Setup

```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify
redis-cli ping  # Should return PONG
```

### 3. MinIO Setup (Optional, use S3 in production)

```bash
# Download MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio

# Create data directory
mkdir -p ~/minio/data

# Start MinIO
export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin
./minio server ~/minio/data --console-address ":9001"

# Create bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/content-pipeline
```

### 4. Application Deployment

```bash
# Install dependencies
npm ci --production

# Build TypeScript
npm run build

# Start API server
npm start

# Start workers (in separate terminal/process)
npm run workers
```

### 5. Process Management with PM2

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'content-pipeline-api',
      script: './dist/api/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'content-pipeline-workers',
      script: './dist/workers/scriptAgent.js',
      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup
```

---

## Production Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `S3_ENDPOINT` | Yes | - | S3/MinIO endpoint URL |
| `S3_BUCKET` | Yes | `content-pipeline` | Storage bucket name |
| `S3_ACCESS_KEY` | Yes* | - | MinIO/S3 access key |
| `S3_SECRET_KEY` | Yes* | - | MinIO/S3 secret key |
| `AWS_ACCESS_KEY_ID` | Yes* | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes* | - | AWS secret key |
| `AWS_REGION` | No | `us-east-1` | AWS region |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for LLM |
| `PORT` | No | `3000` | API server port |
| `NODE_ENV` | No | `development` | Environment mode |

*Either MinIO or AWS credentials required

### Security Checklist

- [ ] Use strong passwords for database
- [ ] Enable SSL/TLS for database connections
- [ ] Use IAM roles instead of access keys when possible
- [ ] Store secrets in environment variables, never in code
- [ ] Enable Redis password authentication
- [ ] Configure firewall rules
- [ ] Use HTTPS for API (behind reverse proxy)
- [ ] Set up API rate limiting
- [ ] Enable request logging

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Monitoring and Logging

### Application Logs

```bash
# View PM2 logs
pm2 logs

# View specific app logs
pm2 logs content-pipeline-api

# Docker logs
docker-compose -f docker/docker-compose.yml logs -f
```

### Health Checks

```bash
# API health check
curl http://localhost:3000/health

# Database check
psql $DATABASE_URL -c "SELECT 1;"

# Redis check
redis-cli -u $REDIS_URL ping
```

### Key Metrics to Monitor

| Metric | Query/Command | Alert Threshold |
|--------|--------------|-----------------|
| Queue Depth | `LLEN bull:script-generation:wait` | > 100 |
| Failed Jobs | `SELECT COUNT(*) FROM jobs WHERE status='failed'` | > 0 |
| Episode Completion | `SELECT COUNT(*) FROM episodes WHERE status='completed'` | N/A |
| API Response Time | Log/metrics | > 2s |
| Error Rate | Log analysis | > 1% |

### Prometheus/Grafana (Optional)

Add metrics endpoint and scrape with Prometheus:

```typescript
// Add to api/index.ts
app.get('/metrics', async (req, res) => {
  // Return Prometheus format metrics
});
```

---

## Backup and Recovery

### Database Backup

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_${DATE}.sql

# Upload to S3
aws s3 cp backup_${DATE}.sql s3://your-backup-bucket/content-pipeline/

# Keep only last 30 days
find . -name "backup_*.sql" -mtime +30 -delete
```

### Storage Backup

```bash
# MinIO mirror
mc mirror local/content-pipeline backup/content-pipeline

# Or use S3 versioning
aws s3 sync s3://content-pipeline s3://content-pipeline-backup
```

### Recovery

```bash
# Restore database
psql -d content_pipeline < backup_20240115_120000.sql

# Restore storage
mc mirror backup/content-pipeline local/content-pipeline
```

---

## Troubleshooting

### Common Issues

#### Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify connection string
psql $DATABASE_URL -c "SELECT 1;"

# Check firewall
sudo ufw allow 5432/tcp  # If remote
```

#### Redis Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Check Redis status
sudo systemctl status redis-server

# Verify connection
redis-cli ping
```

#### Storage Upload Error

```
Error: UnknownEndpoint: Inaccessible host
```

**Solution:**
```bash
# Verify MinIO/S3 is running
curl $S3_ENDPOINT

# Check credentials
mc alias set local $S3_ENDPOINT $S3_ACCESS_KEY $S3_SECRET_KEY
mc ls local

# Verify bucket exists
mc ls local/$S3_BUCKET
```

#### Worker Not Processing Jobs

**Solution:**
```bash
# Check queue status
redis-cli -u $REDIS_URL LRANGE bull:script-generation:wait 0 -1

# Restart workers
pm2 restart content-pipeline-workers

# Check worker logs
pm2 logs content-pipeline-workers
```

#### High Memory Usage

**Solution:**
```bash
# Check PM2 memory
pm2 monit

# Restart with memory limit
pm2 restart content-pipeline-workers --max-memory-restart 512M
```

### Debug Mode

Enable detailed logging:

```bash
DEBUG=* npm start
```

### Support

For issues not covered here:
1. Check logs: `pm2 logs` or Docker logs
2. Review database: Query job and episode tables
3. Check queue status: Redis CLI
4. File an issue on GitHub
