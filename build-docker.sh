#!/usr/bin/env bash
set -e

echo "🔨 Building Docker image for Flask server with Nix flakes..."

# Build the Docker image using Nix
nix build .#dockerImage

echo "📦 Loading Docker image into Docker daemon..."

# Load the image into Docker
docker load < result

echo "✅ Docker image built and loaded successfully!"
echo ""
echo "Image name: iot-flask-server:latest"
echo ""
echo "Next steps:"
echo "1. Start all services with docker-compose:"
echo "   docker-compose up -d"
echo ""
echo "2. View logs:"
echo "   docker-compose logs -f"
echo ""
echo "3. Test locally:"
echo "   Open http://localhost:8000 in your browser"
echo "   Test MQTT: mosquitto_pub -h localhost -t test/topic -m 'hello'"
echo ""
echo "4. Deploy to AWS:"
echo "   ./deploy-to-aws.sh <EC2_IP> <SSH_KEY_PATH>"
