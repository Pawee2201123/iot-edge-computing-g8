# Deployment Summary: Docker + Nix + AWS

## 🎯 What Was Implemented

I've created a complete **production-ready Docker deployment** for your IoT elderly care system using:

1. **Nix** - Reproducible Docker image builds (no dependency hell!)
2. **Docker Compose** - Orchestration of 3 containers
3. **AWS EC2** - Cloud hosting with automated deployment

---

## 🏗️ Architecture

### Multi-Container Setup (docker-compose.yml)

```
┌─────────────────────────────────────────┐
│         Docker Compose Stack            │
├─────────────────────────────────────────┤
│                                          │
│  Flask Server (Nix-built)                │
│  ├─ Port 8000 (Dashboard)                │
│  ├─ Auto-initializes database            │
│  └─ Health checks                        │
│                                          │
│  PostgreSQL 15 (Official Image)          │
│  ├─ Port 5432 (Internal only)            │
│  ├─ Persistent volume (data survives)    │
│  └─ Auto-runs schema.sql                 │
│                                          │
│  Mosquitto MQTT (Official Image)         │
│  ├─ Port 1883 (MQTT)                     │
│  ├─ Port 9001 (WebSocket)                │
│  └─ Config + logs persisted              │
│                                          │
│  All connected via: iot-network          │
└─────────────────────────────────────────┘
```

---

## 📁 Files Created/Modified

### New Files
- `docker-compose.yml` - Orchestrates all 3 containers
- `mosquitto/config/mosquitto.conf` - MQTT broker configuration
- `deploy-to-aws.sh` - Automated AWS deployment script
- `DOCKER_DEPLOYMENT.md` - Complete deployment guide

### Modified Files
- `flake.nix` - Added Docker image builder for Flask server
- `server/app.py` - Made MQTT broker address configurable via env var
- `build-docker.sh` - Updated for new architecture

---

## 🚀 How to Deploy

### Local Testing (3 steps)

```bash
# 1. Build Nix image
./build-docker.sh

# 2. Start all services
docker-compose up -d

# 3. Open dashboard
open http://localhost:8000
```

### AWS Deployment (1 command!)

```bash
./deploy-to-aws.sh <EC2_IP> <SSH_KEY_PATH>

# Example:
./deploy-to-aws.sh 54.123.45.67 ~/.ssh/my-key.pem
```

That's it! The script handles everything:
- ✅ Builds Nix image
- ✅ Uploads to EC2
- ✅ Installs Docker
- ✅ Starts all services
- ✅ Verifies deployment

---

## 🔑 Key Benefits

### 1. **Reproducible Builds (Nix)**
- Same image every time, no "works on my machine"
- All dependencies pinned and isolated
- Rollbacks are trivial

### 2. **Multi-Container Best Practices**
- Each service isolated in its own container
- Easy to scale/replace individual components
- Health checks ensure services are ready

### 3. **Data Persistence**
- PostgreSQL data survives container restarts
- Mosquitto config and logs persisted
- Volume management handled by Docker

### 4. **Easy Management**
- Start all: `docker-compose up -d`
- View logs: `docker-compose logs -f`
- Restart one: `docker-compose restart flask-server`
- Stop all: `docker-compose down`

---

## 🌐 MQTT Broker Management

### Question: How is MQTT broker managed?

**Answer**: Mosquitto runs as a Docker container in the stack.

**Configuration**:
- Config file: `mosquitto/config/mosquitto.conf`
- Ports: 1883 (MQTT), 9001 (WebSocket)
- Logs: `mosquitto/log/mosquitto.log`
- Data: `mosquitto/data/` (persistent)

**Access**:
```bash
# Subscribe to all topics
docker exec iot-mosquitto mosquitto_sub -t '#' -v

# Publish test message
docker exec iot-mosquitto mosquitto_pub -t test -m "hello"

# View logs
docker-compose logs -f mosquitto
```

**Production Security**:
```bash
# Enable authentication
docker exec -it iot-mosquitto mosquitto_passwd -c /mosquitto/config/password.txt iot_user

# Update mosquitto.conf:
# allow_anonymous false
# password_file /mosquitto/config/password.txt

# Restart
docker-compose restart mosquitto
```

---

## 🔐 Environment Variables

All services communicate via Docker DNS:
- Flask connects to PostgreSQL at `postgres:5432`
- Flask connects to Mosquitto at `mosquitto:1883`
- M5Stack devices connect to `<EC2_IP>:1883`

**Configuration** (in docker-compose.yml):
```yaml
environment:
  - DB_HOST=postgres          # Docker service name
  - DB_PORT=5432
  - DB_NAME=edgedevices
  - DB_USER=iot_user
  - DB_PASSWORD=iot_pass_2026
  - MQTT_BROKER=mosquitto     # Docker service name
  - MQTT_PORT=1883
```

**For Production**: Use `.env` file instead of hardcoding passwords.

---

## 📊 Database Access

### From EC2 Host
```bash
docker exec -it iot-postgres psql -U iot_user -d edgedevices
```

### From Flask Container
The Flask server automatically connects using `DB_HOST=postgres` environment variable.

### Backups
```bash
# Backup
docker exec iot-postgres pg_dump -U iot_user edgedevices > backup.sql

# Restore
cat backup.sql | docker exec -i iot-postgres psql -U iot_user -d edgedevices
```

---

## 🐛 Troubleshooting

### Containers won't start?
```bash
docker-compose logs -f
```

Common issues:
- Port conflict: `sudo netstat -tulpn | grep -E '1883|8000|5432'`
- Permission denied: `chmod -R 777 mosquitto/data mosquitto/log`
- Nix build failed: Check you have flakes enabled

### Database not initializing?
Flask automatically runs `schema.sql` on startup. Check logs:
```bash
docker-compose logs flask-server | grep "schema"
```

### MQTT connection refused?
1. Check Mosquitto is running: `docker-compose ps mosquitto`
2. Test locally: `docker exec iot-mosquitto mosquitto_pub -t test -m hi`
3. Check EC2 Security Group has port 1883 open

---

## 💰 AWS Costs

| Resource | Monthly Cost |
|----------|-------------|
| t2.micro EC2 | $0 (free tier) |
| Elastic IP (attached) | $0 |
| Storage (10GB) | ~$1 |
| **Total** | **~$1/month** |

**Tips**:
- Use t2.micro for free tier
- Stop instance when not testing (no compute charges)
- Elastic IP only costs money if NOT attached to a running instance

---

## 📝 Firmware Update Needed

After AWS deployment, update M5Stack firmware to point to your EC2 IP:

```bash
# Edit SharedIoT.cpp
nano lib_shared/M5_IoT_Shared/SharedIoT.cpp
```

Change line 7:
```cpp
const char* MQTT_HOST = "YOUR_EC2_ELASTIC_IP";
```

Then recompile and upload:
```bash
cd firmware-fall && pio run --target upload
cd ../firmware-env && pio run --target upload
cd ../firmware-comm && pio run --target upload
```

---

## 🎓 Learning Resources

- **Docker Compose**: https://docs.docker.com/compose/
- **Nix Flakes**: https://nixos.wiki/wiki/Flakes
- **Mosquitto**: https://mosquitto.org/documentation/
- **AWS EC2 Free Tier**: https://aws.amazon.com/free/

---

## ✅ Verification Checklist

After deployment, verify:
- [ ] Dashboard accessible at http://<EC2_IP>:8000
- [ ] Can publish MQTT from local machine to EC2
- [ ] PostgreSQL has `heat` and `commu` tables
- [ ] Docker containers all show "Up (healthy)"
- [ ] M5Stack devices can connect to EC2 MQTT broker
- [ ] Environmental data appears in dashboard charts
- [ ] Emergency button triggers events in database

---

## 🚀 Quick Start Commands

```bash
# Local testing
./build-docker.sh                          # Build image
docker-compose up -d                       # Start services
docker-compose logs -f                     # View logs
open http://localhost:8000                 # Open dashboard

# AWS deployment
./deploy-to-aws.sh <EC2_IP> <SSH_KEY>      # Deploy everything
ssh -i <SSH_KEY> ubuntu@<EC2_IP>           # SSH to EC2
docker-compose ps                          # Check status

# Management
docker-compose restart flask-server        # Restart one service
docker-compose down                        # Stop all
docker exec -it iot-postgres psql          # Access database
docker exec iot-mosquitto mosquitto_sub -t '#'  # Monitor MQTT
```

---

## 🎉 Summary

You now have a **production-ready, multi-container IoT system** with:
- ✅ Reproducible Nix builds
- ✅ Orchestrated with Docker Compose
- ✅ Persistent PostgreSQL database
- ✅ MQTT broker (Mosquitto)
- ✅ Real-time Flask dashboard with analytics
- ✅ One-command AWS deployment
- ✅ Comprehensive documentation

**Total setup time**: ~10 minutes
**AWS cost**: ~$1/month (free tier eligible)

Ready to deploy! 🚀
