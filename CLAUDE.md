# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an IoT elderly care monitoring system built with M5Stack Core2 (ESP32) devices. It consists of three types of firmware units communicating via MQTT, a Python Flask backend with WebSocket support, and a real-time web dashboard.

**Architecture Pattern**: Edge devices → MQTT broker → Python server → WebSocket → Web dashboard

## Development Commands

### Firmware (PlatformIO)

All firmware projects use PlatformIO with the M5Stack Core2 board. Each unit has its own directory:
- `firmware-fall/` - Fall detection unit (wearable belt sensor)
- `firmware-env/` - Environmental monitoring unit (temperature/humidity/pressure)
- `firmware-comm/` - Communication unit (bedside emergency button + message display)

```bash
# Build firmware
cd firmware-<unit>
pio run

# Upload to device
pio run --target upload

# Monitor serial output
pio device monitor --baud 115200

# Clean build
pio run --target clean
```

**Note**: Update `upload_port` in `platformio.ini` before uploading.

### Backend Server

```bash
# Start MQTT broker (required before server)
mosquitto -c mosquitto.conf

# Run Python server (from root directory)
cd server
python app.py
# Server runs at http://0.0.0.0:8000
```

Dependencies: Flask, Flask-SocketIO, paho-mqtt, eventlet

### Nix Development Environment

```bash
# Enter development shell with all dependencies
nix develop
```

The flake provides: PlatformIO, Python 3 (with Flask/MQTT/eventlet), Node.js, Mosquitto, and system libraries.

## Code Architecture

### Shared Library Pattern

All firmware units depend on a shared library at `lib_shared/M5_IoT_Shared/`:
- **SharedIoT.h/cpp**: Common Wi-Fi connection, MQTT management, and heartbeat logic
- **Key functions**:
  - `setup_wifi(device_name)` - Connects to Wi-Fi with timeout and hostname setting
  - `ensure_mqtt(client, client_id)` - Reconnects MQTT if disconnected (non-blocking)
  - `send_heartbeat(client, client_id, topic)` - Sends 30-second heartbeat with battery voltage

**IMPORTANT**: Wi-Fi credentials and MQTT broker IP are hardcoded in `SharedIoT.cpp`. Change these for your network:
```cpp
const char* WIFI_SSID = "your-ssid";
const char* WIFI_PASS = "your-password";
const char* MQTT_HOST = "192.168.x.x";  // MQTT broker IP
```

### MQTT Topics

The system uses a hierarchical topic structure:

**Fall Detector Unit** (`Belt_Fall_Detector`):
- `home/user_belt/safety/alert` - Critical fall alerts (G-force > 2.5)
- `home/user_belt/safety/status` - Heartbeat messages

**Environmental Unit** (`Living_Room_Env`):
- `home/living_room/env/telemetry` - Sensor readings every 5 seconds
- `home/living_room/env/status` - Heartbeat messages

**Communication Unit** (`Bedside_Comm_Unit`):
- `home/bedside/comm/button` - Emergency help button presses
- `home/bedside/comm/display` - Incoming messages from server (subscribed)
- `home/bedside/comm/status` - Heartbeat messages

### Backend Message Flow

The Python server (`server/app.py`) acts as a bridge:
1. Subscribes to all MQTT topics via `paho-mqtt`
2. Processes incoming messages in `on_message()`
3. Emits WebSocket events to connected browsers via Flask-SocketIO:
   - `'alert'` - Fall/help emergencies (triggers audio)
   - `'status'` - Device heartbeats and sensor data
4. Receives `'send_message'` events from web UI and publishes to `TOPIC_DISPLAY`

### Firmware Loop Pattern

All units follow this structure:
```cpp
void loop() {
    ensure_mqtt(client, UNIT_NAME);  // Reconnect if needed
    client.loop();                   // Process MQTT messages
    send_heartbeat(client, UNIT_NAME, TOPIC_STATUS);  // 30s heartbeat

    // Unit-specific logic here
}
```

### Fall Detection Logic

`firmware-fall/src/main.cpp`:
- Samples IMU at 100Hz (`delay(10)`)
- Calculates total G-force: `sqrt(x² + y² + z²)`
- Triggers alert if > 2.5G with 3-second cooldown to prevent spam
- Sends JSON with `g_force`, `battery`, `priority: CRITICAL`

### Environmental Monitoring

`firmware-env/src/main.cpp`:
- Uses M5Unit ENV III (SHT30 + QMP6988 sensors via I2C on Port A)
- Reads temperature, humidity, pressure every 5 seconds
- Both sensor readings and heartbeats include battery voltage

### Communication Unit

`firmware-comm/src/main.cpp`:
- Subscribes to `TOPIC_DISPLAY` for incoming text messages
- MQTT callback renders messages on LCD with color support (red/green/white)
- Button A triggers emergency alert publication
- Must resubscribe to topics after MQTT reconnection (see loop lines 72-78)

### Web Dashboard

`server/templates/index.html` + `server/static/app.js`:
- Uses Socket.IO for real-time updates (no polling)
- Maintains device state map indexed by `unit_id`
- Plays audio alerts on fall/help events (requires user gesture to enable)
- Displays battery levels with color coding (voltage → percentage conversion)
- Alert feed shows last 50 events with timestamps

## Key Technical Details

### PlatformIO Configuration

Each `platformio.ini` includes:
```ini
lib_extra_dirs = ../lib_shared
lib_ldf_mode = deep  # Required for cross-directory dependencies
lib_deps =
    m5stack/M5Core2 @ ^0.1.5
    bblanchon/ArduinoJson @ ^6.21.3
    knolleary/PubSubClient @ ^2.8
    M5_IoT_Shared  # The shared library
```

### Battery Monitoring

All devices report `M5.Axp.GetBatVoltage()` (AXP192 power management IC specific to M5Stack Core2). The web dashboard converts voltage to percentage assuming linear 3.2V-4.2V range.

### Watchdog Logic

Server considers devices offline if no heartbeat received for >40 seconds (30s interval + 10s grace). This is not implemented in the provided code but mentioned in the README.

### Vibration Motor

Both fall detector and comm unit use `M5.Axp.SetLDOEnable(3, true/false)` to control the vibration motor.

## Testing Workflow

1. Start MQTT broker: `mosquitto -c mosquitto.conf`
2. Start server: `cd server && python app.py`
3. Open browser to http://localhost:8000
4. Upload firmware to each M5Stack device
5. Monitor serial output for connection status and MQTT messages
6. Test emergency button on comm unit
7. Test fall detection by shaking fall detector unit
8. Send messages from web dashboard to comm unit

## Deployment

### Docker Deployment (Recommended)

The project uses Nix flakes to build a reproducible Docker image containing both Mosquitto and Flask server.

```bash
# Build Docker image
./build-docker.sh
# OR: nix build .#dockerImage && docker load < result

# Deploy to AWS EC2 (automated)
./deploy-to-ec2.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>

# Test locally
docker run -p 1883:1883 -p 8000:8000 iot-elderly-care:latest
```

The flake.nix includes:
- `packages.dockerImage` - Layered Docker image with all dependencies
- `devShells.default` - Development environment with PlatformIO and Python

See DOCKER_DEPLOYMENT.md for detailed EC2 deployment instructions.

After deploying to EC2, update `lib_shared/M5_IoT_Shared/SharedIoT.cpp` line 7 with the EC2 public IP (or Elastic IP), then recompile and upload firmware to all devices.

## Branch Information

- Main branch: `main`
- Current working branch: `api`
- Modified file: `lib_shared/M5_IoT_Shared/SharedIoT.cpp` (likely contains network credentials)
