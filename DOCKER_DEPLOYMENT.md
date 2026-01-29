# Docker Deployment Guide (Nix Flakes)

This guide shows how to deploy the IoT Elderly Care system to AWS EC2 using a Docker image built with Nix flakes.

## Benefits of This Approach

✅ **Reproducible builds** - Same image every time, no dependency conflicts
✅ **Minimal image size** - Nix layered images are optimized
✅ **Single container** - Both Mosquitto and Flask server in one container
✅ **Easy rollbacks** - Just redeploy previous image
✅ **No manual dependency installation** - Everything is in the image

## Prerequisites

- Nix with flakes enabled
- Docker installed locally
- AWS EC2 instance (Ubuntu recommended)
- SSH access to EC2

## Quick Start (Automated Deployment)

```bash
# One-command deployment
./deploy-to-ec2.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>

# Example
./deploy-to-ec2.sh 54.123.45.67 ~/.ssh/my-ec2-key.pem
```

This script will:
1. Build the Docker image using Nix
2. Save it as a compressed tarball
3. Upload to your EC2 instance
4. Install Docker on EC2 (if needed)
5. Load and run the container

## Manual Step-by-Step Deployment

### Step 1: Build Docker Image Locally

```bash
# Build the image
./build-docker.sh

# Or manually:
nix build .#dockerImage
docker load < result
```

Expected output:
```
Loaded image: iot-elderly-care:latest
```

### Step 2: Test Locally (Optional)

```bash
# Run the container locally
docker run --rm -p 1883:1883 -p 8000:8000 iot-elderly-care:latest

# In another terminal, test MQTT
mosquitto_pub -h localhost -t "test/topic" -m "hello"

# Access dashboard
# Open browser: http://localhost:8000
```

### Step 3: Save Image for Transfer

```bash
docker save iot-elderly-care:latest | gzip > iot-elderly-care.tar.gz
```

This creates a compressed archive (~200-300MB depending on dependencies).

### Step 4: Launch EC2 Instance

1. **AMI**: Ubuntu Server 22.04 LTS
2. **Instance Type**: t2.micro (free tier) or t3.small
3. **Storage**: 8GB minimum
4. **Security Group**: Configure inbound rules

| Type | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| SSH | TCP | 22 | Your IP | Remote access |
| Custom TCP | TCP | 1883 | 0.0.0.0/0 | MQTT broker |
| Custom TCP | TCP | 8000 | 0.0.0.0/0 | Web dashboard |

### Step 5: Upload Image to EC2

```bash
scp -i your-key.pem iot-elderly-care.tar.gz ubuntu@<EC2_IP>:~/
```

### Step 6: Setup Docker on EC2

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_IP>

# Install Docker
sudo apt update
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# Log out and back in for group changes to take effect
exit
ssh -i your-key.pem ubuntu@<EC2_IP>
```

### Step 7: Load and Run Container

```bash
# Load the image
docker load < iot-elderly-care.tar.gz

# Run the container
docker run -d \
    --name iot-dashboard \
    --restart unless-stopped \
    -p 1883:1883 \
    -p 8000:8000 \
    iot-elderly-care:latest

# Check logs
docker logs -f iot-dashboard
```

Expected output in logs:
```
Starting Mosquitto MQTT Broker...
Waiting for Mosquitto to be ready...
Starting IoT Dashboard...
✅ Dashboard Connected to MQTT (Code: 0)
🚀 Server running at http://0.0.0.0:8000
```

### Step 8: Update M5Stack Firmware

Update the MQTT broker IP in your firmware:

```bash
# On your local machine
nano lib_shared/M5_IoT_Shared/SharedIoT.cpp
```

Change line 7 to your EC2 public IP:
```cpp
const char* MQTT_HOST = "54.123.45.67";  // Your EC2 IP
```

**Important**: Use an Elastic IP to prevent IP changes on reboot.

#### Allocate Elastic IP (Recommended):
```bash
# AWS Console → EC2 → Elastic IPs → Allocate Elastic IP
# Then associate with your instance
```

Recompile and upload firmware to all devices:
```bash
cd firmware-fall && pio run --target upload
cd ../firmware-env && pio run --target upload
cd ../firmware-comm && pio run --target upload
```

## Container Management

### View Logs
```bash
docker logs -f iot-dashboard
```

### Restart Container
```bash
docker restart iot-dashboard
```

### Stop Container
```bash
docker stop iot-dashboard
```

### Update Deployment (New Version)

```bash
# On local machine
./deploy-to-ec2.sh <EC2_IP> <SSH_KEY>

# OR manually:
# 1. Build new image
nix build .#dockerImage
docker load < result
docker save iot-elderly-care:latest | gzip > iot-elderly-care.tar.gz

# 2. Upload to EC2
scp -i key.pem iot-elderly-care.tar.gz ubuntu@<EC2_IP>:~/

# 3. On EC2
ssh -i key.pem ubuntu@<EC2_IP>
docker stop iot-dashboard
docker rm iot-dashboard
docker load < iot-elderly-care.tar.gz
docker run -d --name iot-dashboard --restart unless-stopped \
    -p 1883:1883 -p 8000:8000 iot-elderly-care:latest
```

## Troubleshooting

### Build fails with "experimental features"

Enable flakes in Nix:
```bash
# Add to ~/.config/nix/nix.conf or /etc/nix/nix.conf
experimental-features = nix-command flakes
```

### Container fails to start

Check logs:
```bash
docker logs iot-dashboard
```

Common issues:
- Port already in use: `sudo netstat -tulpn | grep -E '1883|8000'`
- Mosquitto config error: Check mosquitto.conf syntax

### M5Stack can't connect to MQTT

1. **Test MQTT from external network:**
   ```bash
   mosquitto_pub -h <EC2_IP> -t "test" -m "external test"
   ```

2. **Check EC2 Security Group** - Ensure port 1883 is open

3. **Verify container is listening:**
   ```bash
   ssh -i key.pem ubuntu@<EC2_IP>
   docker exec iot-dashboard netstat -tlnp
   ```

### Dashboard not accessible

1. **Check if Flask is running:**
   ```bash
   docker logs iot-dashboard | grep "Server running"
   ```

2. **Test from EC2:**
   ```bash
   curl http://localhost:8000
   ```

3. **Check Security Group** - Port 8000 must be open

## Production Enhancements

### 1. Persist Data with Volumes

If you want to persist MQTT messages or logs:

```bash
docker run -d \
    --name iot-dashboard \
    --restart unless-stopped \
    -p 1883:1883 \
    -p 8000:8000 \
    -v /home/ubuntu/mosquitto-data:/var/lib/mosquitto \
    iot-elderly-care:latest
```

### 2. Add MQTT Authentication

Modify flake.nix to include password file, or mount it:

```bash
# On EC2, create password file
docker exec -it iot-dashboard mosquitto_passwd -c /etc/mosquitto/passwd iot_user

# Update mosquitto.conf to use authentication
# Rebuild and redeploy
```

### 3. HTTPS with Nginx Reverse Proxy

```bash
# Install nginx on EC2
sudo apt install nginx certbot python3-certbot-nginx

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/iot-dashboard

# Add Let's Encrypt SSL
sudo certbot --nginx -d yourdomain.com
```

### 4. Monitor with Docker Stats

```bash
docker stats iot-dashboard
```

### 5. Auto-update with Watchtower (Optional)

```bash
docker run -d \
    --name watchtower \
    -v /var/run/docker.sock:/var/run/docker.sock \
    containrrr/watchtower \
    iot-dashboard
```

## Cost Optimization

- **t2.micro**: Free tier eligible for 12 months
- **Elastic IP**: Free while associated with running instance
- **Stop instance when not testing**: No compute charges
- **Use spot instances**: Up to 90% savings for development

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Docker Container                │
│                                         │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │  Mosquitto   │  │  Flask Server   │ │
│  │  (Port 1883) │  │  (Port 8000)    │ │
│  └──────┬───────┘  └────────┬────────┘ │
│         │                   │          │
│         └───────────┬───────┘          │
└─────────────────────┼──────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │   EC2 Host    │
              │ (Ubuntu 22.04)│
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼───┐   ┌────▼───┐   ┌────▼───┐
   │M5Stack │   │M5Stack │   │M5Stack │
   │  Fall  │   │  Env   │   │  Comm  │
   └────────┘   └────────┘   └────────┘
```

## Security Checklist

- [ ] EC2 Security Group restricts SSH to your IP only
- [ ] Elastic IP allocated to prevent IP changes
- [ ] MQTT authentication enabled (production)
- [ ] Regular system updates: `sudo apt update && sudo apt upgrade`
- [ ] Docker image scanned for vulnerabilities: `docker scan iot-elderly-care:latest`
- [ ] Backup docker-compose or run commands documented
- [ ] CloudWatch monitoring enabled (optional)

## Quick Commands Reference

```bash
# Local Development
nix build .#dockerImage          # Build image
docker load < result             # Load into Docker
./build-docker.sh                # Automated build

# Deployment
./deploy-to-ec2.sh <IP> <KEY>    # Automated deploy
docker logs -f iot-dashboard     # View logs
docker restart iot-dashboard     # Restart service
docker exec -it iot-dashboard sh # Debug shell

# EC2 Management
ssh -i key.pem ubuntu@<IP>       # Connect to EC2
docker ps -a                     # List containers
docker system prune -a           # Clean unused images
```

## Next Steps

1. ✅ Deploy to EC2 using this guide
2. Test M5Stack connectivity
3. Set up monitoring (CloudWatch or custom)
4. Add MQTT authentication for production
5. Configure domain name and HTTPS
6. Set up automated backups
7. Document incident response procedures
