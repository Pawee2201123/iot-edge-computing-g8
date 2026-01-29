#!/usr/bin/env bash
set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check arguments
if [ "$#" -lt 2 ]; then
    echo -e "${RED}Usage: $0 <EC2_PUBLIC_IP> <SSH_KEY_PATH>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 54.123.45.67 ~/.ssh/my-ec2-key.pem"
    exit 1
fi

EC2_IP=$1
SSH_KEY=$2
EC2_USER=${EC2_USER:-ubuntu}

# Validate SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH key not found: $SSH_KEY${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Deploying IoT Elder Care System to AWS EC2${NC}"
echo "Target: $EC2_USER@$EC2_IP"
echo ""

# Step 1: Build Docker image
echo -e "${YELLOW}Step 1: Building Docker image with Nix...${NC}"
nix build .#dockerImage
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nix build successful${NC}"
else
    echo -e "${RED}❌ Nix build failed${NC}"
    exit 1
fi

# Step 2: Load image into Docker
echo -e "${YELLOW}Step 2: Loading image into Docker...${NC}"
docker load < result
echo -e "${GREEN}✅ Image loaded${NC}"

# Step 3: Save image as tarball
echo -e "${YELLOW}Step 3: Saving Docker image...${NC}"
docker save iot-flask-server:latest | gzip > /tmp/iot-flask-server.tar.gz
IMAGE_SIZE=$(du -h /tmp/iot-flask-server.tar.gz | cut -f1)
echo -e "${GREEN}✅ Image saved: /tmp/iot-flask-server.tar.gz ($IMAGE_SIZE)${NC}"

# Step 4: Create deployment package
echo -e "${YELLOW}Step 4: Creating deployment package...${NC}"
mkdir -p /tmp/iot-deploy
cp docker-compose.yml /tmp/iot-deploy/
cp -r mosquitto /tmp/iot-deploy/
cp server/schema.sql /tmp/iot-deploy/
cd /tmp/iot-deploy
tar czf /tmp/iot-deploy-package.tar.gz .
cd -
echo -e "${GREEN}✅ Deployment package created${NC}"

# Step 5: Upload to EC2
echo -e "${YELLOW}Step 5: Uploading files to EC2...${NC}"
echo "This may take a few minutes depending on your connection..."

scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
    /tmp/iot-flask-server.tar.gz \
    /tmp/iot-deploy-package.tar.gz \
    $EC2_USER@$EC2_IP:~/

echo -e "${GREEN}✅ Files uploaded${NC}"

# Step 6: Setup and deploy on EC2
echo -e "${YELLOW}Step 6: Setting up EC2 instance...${NC}"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP << 'ENDSSH'
set -e

echo "📦 Installing Docker and Docker Compose if needed..."
if ! command -v docker &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose curl
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi

echo "🧹 Cleaning up old deployment..."
cd ~
docker-compose down 2>/dev/null || true
rm -rf iot-deploy
mkdir -p iot-deploy
cd iot-deploy

echo "📦 Extracting deployment package..."
tar xzf ~/iot-deploy-package.tar.gz

echo "🐳 Loading Docker image..."
docker load < ~/iot-flask-server.tar.gz

echo "🚀 Starting services with docker-compose..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Services:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Mosquitto MQTT: localhost:1883"
echo "  - Flask Dashboard: http://localhost:8000"
echo ""
echo "View logs with: docker-compose logs -f"
ENDSSH

echo ""
echo -e "${GREEN}🎉 Deployment successful!${NC}"
echo ""
echo "Access your dashboard at: http://$EC2_IP:8000"
echo "MQTT broker available at: $EC2_IP:1883"
echo ""
echo "Next steps:"
echo "1. Update firmware MQTT_HOST to: $EC2_IP"
echo "2. SSH into EC2: ssh -i $SSH_KEY $EC2_USER@$EC2_IP"
echo "3. View logs: cd ~/iot-deploy && docker-compose logs -f"
echo ""
echo -e "${YELLOW}⚠️  Remember to configure EC2 Security Group:${NC}"
echo "  - Port 22 (SSH) - Your IP only"
echo "  - Port 1883 (MQTT) - 0.0.0.0/0"
echo "  - Port 8000 (HTTP) - 0.0.0.0/0"
echo ""
echo -e "${YELLOW}💡 Tip: Use an Elastic IP to prevent IP changes on reboot${NC}"

# Cleanup
rm -f /tmp/iot-flask-server.tar.gz /tmp/iot-deploy-package.tar.gz
rm -rf /tmp/iot-deploy
