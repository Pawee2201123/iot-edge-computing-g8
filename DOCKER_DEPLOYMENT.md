# Docker Deployment Guide (Nix + Docker Compose)

This guide shows how to deploy the IoT Elderly Care system to AWS EC2 using Docker Compose with a Nix-built Flask server image.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Compose Stack                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │  Mosquitto   │  │  Flask Server  │  │  PostgreSQL  │ │
│  │  (Port 1883) │  │  (Port 8000)   │  │  (Port 5432) │ │
│  │              │  │                │  │              │ │
│  │ Official     │  │ Nix-built      │  │ Official     │ │
│  │ Image        │  │ Image          │  │ Image        │ │
│  └──────┬───────┘  └────────┬───────┘  └──────┬───────┘ │
│         │                   │                  │         │
│         └───────────────────┴──────────────────┘         │
│                     iot-network (bridge)                  │
└─────────────────────────────────────────────────────────┘
```

## Benefits of This Approach

✅ **Multi-container architecture** - Each service in its own container (best practice)
✅ **Nix-built Flask server** - Reproducible builds, no dependency hell
✅ **Official images for PostgreSQL & Mosquitto** - Battle-tested, secure
✅ **Docker Compose orchestration** - Easy management, health checks, dependencies
✅ **Persistent data** - PostgreSQL data survives container restarts
✅ **Easy rollbacks** - Just redeploy previous version
✅ **Network isolation** - Services communicate on private Docker network

---

## Prerequisites

### Local Machine
- Nix with flakes enabled ([installation guide](https://nixos.org/download.html))
- Docker and Docker Compose installed
- Git (to clone/modify code)

### AWS EC2
- Ubuntu Server 22.04 LTS (or similar)
- Instance Type: t2.micro (free tier) or t3.small
- Storage: 10GB minimum
- Security Group configured (see below)
- SSH key pair

---

## Quick Start (Automated Deployment)

```bash
# One-command deployment to AWS
./deploy-to-aws.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>

# Example
./deploy-to-aws.sh 54.123.45.67 ~/.ssh/my-ec2-key.pem
```

This script will:
1. ✅ Build Flask server image using Nix
2. ✅ Create deployment package with docker-compose.yml
3. ✅ Upload everything to EC2
4. ✅ Install Docker/Docker Compose on EC2 (if needed)
5. ✅ Start all services with health checks
6. ✅ Verify deployment

**Total time**: ~5-10 minutes (depending on your internet speed)

---

## Manual Step-by-Step Deployment

### Step 1: Build Docker Image Locally

```bash
# Build the Nix-based Flask server image
./build-docker.sh
```

This creates the `iot-flask-server:latest` image with:
- Python 3 with Flask, SocketIO, MQTT, PostgreSQL drivers
- Application code bundled inside
- Startup script with database initialization
- All dependencies pinned by Nix (reproducible!)

### Step 2: Test Locally (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

Expected output:
```
NAME                IMAGE                      STATUS
iot-flask-server    iot-flask-server:latest    Up (healthy)
iot-mosquitto       eclipse-mosquitto:2.0      Up (healthy)
iot-postgres        postgres:15-alpine         Up (healthy)
```

Test endpoints:
- Dashboard: http://localhost:8000
- MQTT: `mosquitto_pub -h localhost -t test -m "hello"`
- PostgreSQL: `psql -h localhost -U iot_user -d edgedevices`

Stop services:
```bash
docker-compose down
```

### Step 3: Launch EC2 Instance

#### AMI Selection
- **Recommended**: Ubuntu Server 22.04 LTS (ami-0c7217cdde317cfec)
- **Alternative**: Amazon Linux 2023

#### Instance Type
- **Development**: t2.micro (free tier, 1 vCPU, 1GB RAM)
- **Production**: t3.small (2 vCPU, 2GB RAM) or larger

#### Storage
- **Minimum**: 10GB gp3
- **Recommended**: 20GB gp3 (for database growth)

#### Security Group Configuration

| Type | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| SSH | TCP | 22 | Your IP | Remote access |
| Custom TCP | TCP | 1883 | 0.0.0.0/0 | MQTT broker (M5Stack devices) |
| Custom TCP | TCP | 8000 | 0.0.0.0/0 | Web dashboard |
| Custom TCP | TCP | 5432 | 127.0.0.1/32 | PostgreSQL (internal only) |

**Security Best Practices**:
- ❌ Do NOT expose PostgreSQL (5432) to the internet
- ✅ Restrict SSH to your IP address only
- ✅ Use Elastic IP to prevent IP changes
- ✅ Enable CloudWatch monitoring

#### Elastic IP (Strongly Recommended)

```bash
# AWS Console → EC2 → Elastic IPs → Allocate Elastic IP
# Then associate with your instance
```

Why? Without Elastic IP, your EC2 IP changes every time you stop/start the instance, breaking M5Stack firmware configuration.

### Step 4: Deploy to EC2

Use the automated script:

```bash
./deploy-to-aws.sh 54.123.45.67 ~/.ssh/my-ec2-key.pem
```

Or deploy manually:

```bash
# 1. Save and upload image
docker save iot-flask-server:latest | gzip > iot-flask-server.tar.gz
scp -i key.pem iot-flask-server.tar.gz ubuntu@<EC2_IP>:~/

# 2. Upload docker-compose and config
scp -i key.pem docker-compose.yml ubuntu@<EC2_IP>:~/
scp -i key.pem -r mosquitto ubuntu@<EC2_IP>:~/

# 3. SSH into EC2
ssh -i key.pem ubuntu@<EC2_IP>

# 4. Install Docker
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# 5. Load image and start services
docker load < iot-flask-server.tar.gz
docker-compose up -d

# 6. Check logs
docker-compose logs -f
```

### Step 5: Update M5Stack Firmware

Update the MQTT broker IP in your firmware to point to EC2:

```bash
# On your local machine
nano lib_shared/M5_IoT_Shared/SharedIoT.cpp
```

Change line 7 to your EC2 Elastic IP:
```cpp
const char* MQTT_HOST = "54.123.45.67";  // Your EC2 Elastic IP
```

Recompile and upload to all devices:
```bash
cd firmware-fall && pio run --target upload
cd ../firmware-env && pio run --target upload
cd ../firmware-comm && pio run --target upload
```

---

## Container Management

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f flask-server
docker-compose logs -f postgres
docker-compose logs -f mosquitto
```

### Check Service Status
```bash
docker-compose ps
```

### Restart Services
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart flask-server
```

### Stop and Remove
```bash
# Stop (keeps volumes)
docker-compose stop

# Stop and remove containers (keeps volumes)
docker-compose down

# Stop, remove containers AND volumes (deletes database!)
docker-compose down -v
```

### Access Container Shell
```bash
# Flask server
docker exec -it iot-flask-server /bin/bash

# PostgreSQL
docker exec -it iot-postgres psql -U iot_user -d edgedevices

# Mosquitto
docker exec -it iot-mosquitto sh
```

### Update Deployment
```bash
# Local machine: rebuild and redeploy
./deploy-to-aws.sh <EC2_IP> <SSH_KEY>

# This will:
# - Build new image
# - Upload to EC2
# - Stop old containers
# - Start new containers
# - Database data persists!
```

---

## Database Management

### Access PostgreSQL
```bash
# From EC2 host
docker exec -it iot-postgres psql -U iot_user -d edgedevices

# View tables
\dt

# Query data
SELECT * FROM heat ORDER BY time DESC LIMIT 10;
SELECT * FROM commu WHERE emerg = TRUE;
```

### Backup Database
```bash
# On EC2
docker exec iot-postgres pg_dump -U iot_user edgedevices > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
# On EC2
cat backup_20260129.sql | docker exec -i iot-postgres psql -U iot_user -d edgedevices
```

### View Database Size
```bash
docker exec iot-postgres psql -U iot_user -d edgedevices -c "
  SELECT pg_size_pretty(pg_database_size('edgedevices')) AS db_size;
"
```

---

## MQTT Broker Management

### Test MQTT Connection
```bash
# Subscribe to all topics
docker exec iot-mosquitto mosquitto_sub -t '#' -v

# Publish test message
docker exec iot-mosquitto mosquitto_pub -t test/topic -m "hello from docker"

# External test (from your local machine)
mosquitto_pub -h <EC2_IP> -t test/topic -m "hello from outside"
```

### View Mosquitto Logs
```bash
docker-compose logs -f mosquitto

# Or directly
docker exec iot-mosquitto tail -f /mosquitto/log/mosquitto.log
```

### Enable MQTT Authentication (Production)

```bash
# 1. Create password file
docker exec -it iot-mosquitto mosquitto_passwd -c /mosquitto/config/password.txt iot_user

# 2. Update mosquitto/config/mosquitto.conf
# Change: allow_anonymous false
# Add: password_file /mosquitto/config/password.txt

# 3. Restart Mosquitto
docker-compose restart mosquitto

# 4. Update firmware with credentials
# In SharedIoT.cpp, add:
# client.setUsernamePassword("iot_user", "your_password");
```

---

## Troubleshooting

### Build fails with "experimental features"

Enable flakes in Nix:
```bash
mkdir -p ~/.config/nix
echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
```

### Container fails to start

Check logs:
```bash
docker-compose logs flask-server
```

Common issues:
- **PostgreSQL not ready**: Flask waits for PostgreSQL health check (up to 50 seconds)
- **Port already in use**: `sudo netstat -tulpn | grep -E '1883|8000|5432'`
- **Permission denied**: Ensure `mosquitto/data` and `mosquitto/log` are writable

### M5Stack can't connect to MQTT

1. **Test from external network**:
   ```bash
   mosquitto_pub -h <EC2_IP> -t test -m "external test"
   ```

2. **Check EC2 Security Group** - Port 1883 must be open to 0.0.0.0/0

3. **Verify Mosquitto is listening**:
   ```bash
   docker exec iot-mosquitto netstat -tlnp | grep 1883
   ```

4. **Check firmware has correct IP**:
   ```cpp
   const char* MQTT_HOST = "YOUR_EC2_IP";
   ```

### Dashboard not accessible

1. **Test from EC2**:
   ```bash
   curl http://localhost:8000
   ```

2. **Check Flask logs**:
   ```bash
   docker-compose logs flask-server | grep "Server running"
   ```

3. **Check Security Group** - Port 8000 must be open

### Database connection fails

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
docker exec iot-postgres pg_isready -U iot_user
```

### Out of disk space

```bash
# Check disk usage
df -h

# Clean Docker images
docker system prune -a

# Check volume size
docker system df -v
```

---

## Production Enhancements

### 1. HTTPS with Nginx Reverse Proxy

```bash
# Install nginx on EC2
sudo apt install nginx certbot python3-certbot-nginx

# Configure reverse proxy for port 8000
sudo nano /etc/nginx/sites-available/iot-dashboard

# Add SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com

# Update docker-compose.yml:
# Change flask-server ports to:
#   - "127.0.0.1:8000:8000"  # Only accessible via nginx
```

### 2. Environment Variables File

Create `.env` file instead of hardcoding credentials:

```bash
# .env file
DB_PASSWORD=super_secure_password_here
MQTT_PASSWORD=mqtt_secure_password
```

Update docker-compose.yml:
```yaml
services:
  flask-server:
    env_file:
      - .env
```

### 3. Monitoring with Prometheus

Add to docker-compose.yml:
```yaml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
```

### 4. Automated Backups

```bash
# Create backup script
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR
docker exec iot-postgres pg_dump -U iot_user edgedevices | gzip > $BACKUP_DIR/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz
# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/ubuntu/backup-db.sh
```

### 5. CloudWatch Monitoring

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Configure monitoring
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

---

## Cost Optimization

| Resource | Cost (Monthly) | Optimization |
|----------|---------------|--------------|
| **t2.micro** | $0 (free tier) | Upgrade to t3.small if needed |
| **Elastic IP** | $0 (when attached) | $3.60 if unattached |
| **Storage (10GB)** | ~$1 | Delete unused volumes |
| **Data Transfer** | First 100GB free | Minimal for IoT |

**Total estimated cost**: $0-5/month for development

**Tips**:
- Stop instance when not in use (no compute charges)
- Use spot instances for development (up to 90% savings)
- Set billing alerts in AWS Console

---

## Security Checklist

- [ ] EC2 Security Group restricts SSH to your IP only
- [ ] Elastic IP allocated to prevent IP changes
- [ ] PostgreSQL NOT exposed to internet (5432 internal only)
- [ ] MQTT authentication enabled for production
- [ ] Regular system updates: `sudo apt update && sudo apt upgrade`
- [ ] Docker image scanned: `docker scan iot-flask-server:latest`
- [ ] Backup strategy in place
- [ ] CloudWatch monitoring enabled
- [ ] `.env` file with secure passwords
- [ ] HTTPS enabled with Let's Encrypt
- [ ] Firewall configured: `sudo ufw enable`

---

## Quick Commands Reference

```bash
# Local Development
./build-docker.sh                # Build Nix image
docker-compose up -d             # Start services
docker-compose logs -f           # View logs
docker-compose down              # Stop services

# Deployment
./deploy-to-aws.sh <IP> <KEY>    # Automated deploy
ssh -i key.pem ubuntu@<IP>       # Connect to EC2

# Container Management
docker-compose ps                # List containers
docker-compose restart           # Restart all
docker exec -it <container> sh   # Shell access

# Database
docker exec -it iot-postgres psql -U iot_user -d edgedevices
# Backup: pg_dump
# Restore: psql < backup.sql

# MQTT
docker exec iot-mosquitto mosquitto_sub -t '#' -v
docker exec iot-mosquitto mosquitto_pub -t test -m "hello"

# Logs
docker-compose logs -f flask-server
docker-compose logs -f postgres
docker-compose logs -f mosquitto

# Cleanup
docker system prune -a           # Remove unused images
docker volume prune              # Remove unused volumes
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     AWS EC2 Instance                     │
│                  (Ubuntu 22.04 LTS)                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Docker Compose Stack (iot-network bridge)               │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Flask Server (iot-flask-server:latest)          │    │
│  │ - Nix-built image                               │    │
│  │ - Waits for PostgreSQL & Mosquitto health       │    │
│  │ - Auto-initializes database schema              │    │
│  │ - Port 8000 (HTTP dashboard)                    │    │
│  └────────────┬──────────────────────┬─────────────┘    │
│               │                      │                   │
│               ▼                      ▼                   │
│  ┌────────────────────┐   ┌─────────────────────┐      │
│  │ Mosquitto MQTT     │   │ PostgreSQL 15       │      │
│  │ (eclipse-mosquitto)│   │ (postgres:alpine)   │      │
│  │ - Port 1883        │   │ - Port 5432         │      │
│  │ - Port 9001 (WS)   │   │ - Volume: postgres- │      │
│  │ - Volume: config   │   │   data (persistent) │      │
│  │ - Volume: data     │   │ - Auto-creates DB   │      │
│  │ - Volume: log      │   │ - Runs schema.sql   │      │
│  └────────────────────┘   └─────────────────────┘      │
│                                                           │
└───────────────────────┬───────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
   │M5Stack  │    │M5Stack  │    │M5Stack  │
   │ Fall    │    │ Env     │    │ Comm    │
   │Detector │    │ Monitor │    │ Unit    │
   └─────────┘    └─────────┘    └─────────┘

        All devices connect to:
        - MQTT: EC2_IP:1883
        - Dashboard: http://EC2_IP:8000
```

---

## Next Steps

1. ✅ Build Docker image locally: `./build-docker.sh`
2. ✅ Test with docker-compose: `docker-compose up`
3. ✅ Deploy to AWS: `./deploy-to-aws.sh <EC2_IP> <SSH_KEY>`
4. ✅ Update M5Stack firmware with EC2 IP
5. ✅ Test M5Stack connectivity
6. Configure domain name and HTTPS (optional)
7. Set up monitoring and alerts (CloudWatch)
8. Enable MQTT authentication for production
9. Configure automated backups
10. Document operational procedures

**Happy Deploying! 🚀**
