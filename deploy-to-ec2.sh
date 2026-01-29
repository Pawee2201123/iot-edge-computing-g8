#!/usr/bin/env bash
set -e

# Configuration
EC2_IP="${1:-}"
SSH_KEY="${2:-}"
IMAGE_NAME="iot-elderly-care:latest"
ARCHIVE_NAME="iot-elderly-care.tar.gz"

if [ -z "$EC2_IP" ] || [ -z "$SSH_KEY" ]; then
    echo "Usage: $0 <EC2_IP> <SSH_KEY_PATH>"
    echo "Example: $0 54.123.45.67 ~/.ssh/my-key.pem"
    exit 1
fi

echo "🚀 Deploying to EC2: $EC2_IP"

# Step 1: Build Docker image
echo "📦 Building Docker image..."
nix build .#dockerImage
docker load < result

# Step 2: Save Docker image
echo "💾 Saving Docker image to tarball..."
docker save "$IMAGE_NAME" | gzip > "$ARCHIVE_NAME"

# Step 3: Copy to EC2
echo "📤 Uploading to EC2..."
scp -i "$SSH_KEY" "$ARCHIVE_NAME" "ubuntu@$EC2_IP:~/"

# Step 4: Deploy on EC2
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
    fi

    # Load the image
    echo "Loading Docker image..."
    docker load < iot-elderly-care.tar.gz

    # Stop existing container if running
    echo "Stopping existing container..."
    docker stop iot-dashboard 2>/dev/null || true
    docker rm iot-dashboard 2>/dev/null || true

    # Run new container
    echo "Starting new container..."
    docker run -d \
        --name iot-dashboard \
        --restart unless-stopped \
        -p 1883:1883 \
        -p 8000:8000 \
        iot-elderly-care:latest

    echo "✅ Deployment complete!"
    echo "Dashboard: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000"
    echo "MQTT Broker: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):1883"
ENDSSH

echo ""
echo "✅ Deployment successful!"
echo "Remember to:"
echo "  1. Update EC2 Security Group to allow ports 1883 and 8000"
echo "  2. Update firmware MQTT_HOST to: $EC2_IP"
echo "  3. Monitor logs: ssh -i $SSH_KEY ubuntu@$EC2_IP 'docker logs -f iot-dashboard'"
