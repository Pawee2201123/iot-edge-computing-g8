#!/usr/bin/env bash
set -e

# Configuration
EC2_IP="${1:-}"
SSH_KEY="${2:-}"

if [ -z "$EC2_IP" ] || [ -z "$SSH_KEY" ]; then
    echo "Usage: $0 <EC2_IP> <SSH_KEY_PATH>"
    echo "Example: $0 54.123.45.67 ~/.ssh/my-key.pem"
    exit 1
fi

echo "🚀 Deploying to EC2: $EC2_IP"

# Step 1: Build Docker image with Nix
echo "📦 Building Docker image with Nix..."
nix build .#dockerImage

# The result is a symlink to the tarball
IMAGE_PATH=$(readlink -f result)

echo "✅ Image built: $IMAGE_PATH"

# Step 2: Upload to EC2
echo "📤 Uploading image to EC2..."
scp -i "$SSH_KEY" "$IMAGE_PATH" "ubuntu@$EC2_IP:~/iot-elderly-care-image.tar.gz"

# Step 3: Deploy on EC2
echo "🔧 Setting up Docker on EC2..."
ssh -i "$SSH_KEY" "ubuntu@$EC2_IP" << 'ENDSSH'
    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        sudo apt update
        sudo apt install -y docker.io
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker ubuntu
        echo "⚠️  Docker installed. You may need to log out and back in for group changes."
    fi

    # Load the image
    echo "📥 Loading Docker image..."
    docker load < iot-elderly-care-image.tar.gz

    # Stop existing container if running
    echo "🛑 Stopping existing container..."
    docker stop iot-dashboard 2>/dev/null || true
    docker rm iot-dashboard 2>/dev/null || true

    # Run new container
    echo "🚀 Starting new container..."
    docker run -d \
        --name iot-dashboard \
        --restart unless-stopped \
        -p 1883:1883 \
        -p 8000:8000 \
        iot-elderly-care:latest

    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📊 Container status:"
    docker ps | grep iot-dashboard || echo "Container not found!"
    echo ""
    echo "📝 View logs:"
    echo "  docker logs -f iot-dashboard"
    echo ""

    # Get public IP
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "$EC2_IP")
    echo "🌐 Access your services:"
    echo "  Dashboard: http://$PUBLIC_IP:8000"
    echo "  MQTT Broker: $PUBLIC_IP:1883"
ENDSSH

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📋 Next steps:"
echo "  1. Update firmware MQTT_HOST to: $EC2_IP"
echo "     Edit: lib_shared/M5_IoT_Shared/SharedIoT.cpp (line 7)"
echo "  2. Recompile and upload firmware to M5Stack devices"
echo "  3. Monitor logs: ssh -i $SSH_KEY ubuntu@$EC2_IP 'docker logs -f iot-dashboard'"
