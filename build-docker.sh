#!/usr/bin/env bash
set -e

echo "🔨 Building Docker image with Nix flakes..."

# Build the Docker image using Nix
nix build .#dockerImage

echo "📦 Loading Docker image..."

# Load the image into Docker
docker load < result

echo "✅ Docker image built and loaded successfully!"
echo ""
echo "To test locally, run:"
echo "  docker run -p 1883:1883 -p 8000:8000 iot-elderly-care:latest"
echo ""
echo "To save for EC2 deployment:"
echo "  docker save iot-elderly-care:latest | gzip > iot-elderly-care.tar.gz"
