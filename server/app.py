import os
# Disable eventlet's greendns to avoid Docker DNS resolution issues
os.environ['EVENTLET_NO_GREENDNS'] = 'yes'

import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO
import paho.mqtt.client as mqtt
import json
import math
from db_config import init_db_pool, insert_commu_data, insert_heat_data, test_connection, close_db_pool

# --- CONFIGURATION ---
import os
MQTT_BROKER = os.getenv('MQTT_BROKER', '127.0.0.1')  # Default to localhost, overridable via env var
MQTT_PORT = int(os.getenv('MQTT_PORT', '1883'))

# Topics to listen to
TOPIC_FALL        = "home/user_belt/safety/alert"
TOPIC_HELP        = "home/bedside/comm/button"
TOPIC_STATUS      = "home/user_belt/safety/status"
TOPIC_ENV         = "home/living_room/env/telemetry"
TOPIC_COMM_STATUS = "home/bedside/comm/status"

# --- UTILITY FUNCTIONS ---
def calculate_wbgt(temp, humidity):
    """
    Calculate simplified WBGT (Wet Bulb Globe Temperature) for indoor conditions

    Args:
        temp (float): Temperature in Celsius
        humidity (float): Relative humidity (0-100)

    Returns:
        float: Approximated WBGT in Celsius

    Note: This is a simplified approximation. For accurate WBGT, you need
    wet bulb temperature, black globe temperature, and air temperature.
    Indoor WBGT ≈ 0.7 * Wet Bulb + 0.3 * Dry Bulb
    """
    try:
        # Simplified wet bulb approximation using temperature and humidity
        # This is based on the Stull formula (2011) for wet bulb temperature
        wet_bulb = temp * math.atan(0.151977 * (humidity + 8.313659)**0.5) + \
                   math.atan(temp + humidity) - \
                   math.atan(humidity - 1.676331) + \
                   0.00391838 * (humidity**1.5) * math.atan(0.023101 * humidity) - \
                   4.686035

        # Indoor WBGT approximation
        wbgt = 0.7 * wet_bulb + 0.3 * temp
        return round(wbgt, 2)
    except Exception as e:
        print(f"⚠️ WBGT calculation error: {e}, using temperature as fallback")
        return round(temp, 2)
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- MQTT SETUP ---
client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    print(f"✅ Dashboard Connected to MQTT (Code: {rc})")
    
    # Subscribe to ALL topics in a single list
    # The '0' is the QoS level (Quality of Service)
    client.subscribe([
        (TOPIC_FALL, 0), 
        (TOPIC_HELP, 0), 
        (TOPIC_STATUS, 0),
        (TOPIC_ENV, 0),
        (TOPIC_COMM_STATUS, 0)
    ])
    print("👂 Listening for:", TOPIC_HELP) # Debug print

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload_str = msg.payload.decode()

        # 1. DEBUG PRINT: Show absolutely everything Python hears
        print(f"DEBUG INCOMING -> Topic: {topic} | Msg: {payload_str}")

        data = json.loads(payload_str)

        # 2. Filter logic and database insertion
        if topic == TOPIC_FALL:
            print(">>> Sending FALL Alert to Web")
            socketio.emit('alert', {'type': 'FALL', 'data': data})

        elif topic == TOPIC_HELP:
            print(">>> Sending HELP Alert to Web")
            socketio.emit('alert', {'type': 'HELP', 'data': data})

            # Insert emergency button press into Commu table
            insert_commu_data(emerg=True, msg="Emergency button pressed")

        elif topic == TOPIC_ENV:
            # Insert environmental data into Heat table
            temp = data.get('temp')
            humidity = data.get('humidity')

            if temp is not None and humidity is not None:
                wbgt = calculate_wbgt(temp, humidity)
                insert_heat_data(temp, humidity, wbgt)
                print(f"📊 Stored env data: T={temp}°C, H={humidity}%, WBGT={wbgt}°C")

            # Still emit to websocket for real-time display
            socketio.emit('status', data)

        elif topic in [TOPIC_STATUS, TOPIC_COMM_STATUS]:
            socketio.emit('status', data)

    except Exception as e:
        print(f"❌ Error parsing MQTT: {e}")

client.on_connect = on_connect
client.on_message = on_message

# --- WEB ROUTES ---
@app.route('/')
def index():
    return render_template('index.html')

# --- REST API ENDPOINTS ---
@app.route('/api/heat/history')
def get_heat_history():
    """Get historical environmental data with optional time filtering"""
    from db_config import get_db_connection
    from datetime import datetime, timedelta

    # Get query parameters
    hours = request.args.get('hours', default=6, type=int)
    limit = request.args.get('limit', default=100, type=int)

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT time, temp, hum, wbgt
                FROM heat
                WHERE time > NOW() - INTERVAL '%s hours'
                ORDER BY time DESC
                LIMIT %s
            """, (hours, limit))

            rows = cursor.fetchall()
            cursor.close()

            # Convert to list of dicts
            data = [{
                'time': row[0].isoformat(),
                'temp': float(row[1]),
                'humidity': float(row[2]),
                'wbgt': float(row[3])
            } for row in rows]

            return json.dumps({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error fetching heat history: {e}")
        return json.dumps({'success': False, 'error': str(e)}), 500

@app.route('/api/commu/history')
def get_commu_history():
    """Get communication event history with optional filtering"""
    from db_config import get_db_connection

    # Get query parameters
    hours = request.args.get('hours', default=24, type=int)
    emerg_only = request.args.get('emerg_only', default='false', type=str).lower() == 'true'
    limit = request.args.get('limit', default=50, type=int)

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            if emerg_only:
                cursor.execute("""
                    SELECT time, emerg, msg
                    FROM commu
                    WHERE time > NOW() - INTERVAL '%s hours'
                    AND emerg = TRUE
                    ORDER BY time DESC
                    LIMIT %s
                """, (hours, limit))
            else:
                cursor.execute("""
                    SELECT time, emerg, msg
                    FROM commu
                    WHERE time > NOW() - INTERVAL '%s hours'
                    ORDER BY time DESC
                    LIMIT %s
                """, (hours, limit))

            rows = cursor.fetchall()
            cursor.close()

            # Convert to list of dicts
            data = [{
                'time': row[0].isoformat(),
                'emerg': bool(row[1]),
                'msg': row[2]
            } for row in rows]

            return json.dumps({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error fetching commu history: {e}")
        return json.dumps({'success': False, 'error': str(e)}), 500

@app.route('/api/stats')
def get_stats():
    """Get dashboard statistics"""
    from db_config import get_db_connection

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Temperature stats (last 24 hours)
            cursor.execute("""
                SELECT
                    COUNT(*) as total_readings,
                    AVG(temp) as avg_temp,
                    MIN(temp) as min_temp,
                    MAX(temp) as max_temp,
                    AVG(hum) as avg_humidity
                FROM heat
                WHERE time > NOW() - INTERVAL '24 hours'
            """)
            temp_stats = cursor.fetchone()

            # Emergency count (last 24 hours)
            cursor.execute("""
                SELECT COUNT(*) FROM commu
                WHERE emerg = TRUE
                AND time > NOW() - INTERVAL '24 hours'
            """)
            emerg_count = cursor.fetchone()[0]

            # Total messages (last 24 hours)
            cursor.execute("""
                SELECT COUNT(*) FROM commu
                WHERE time > NOW() - INTERVAL '24 hours'
            """)
            msg_count = cursor.fetchone()[0]

            cursor.close()

            stats = {
                'temp': {
                    'readings': int(temp_stats[0]) if temp_stats[0] else 0,
                    'avg': round(float(temp_stats[1]), 1) if temp_stats[1] else 0,
                    'min': round(float(temp_stats[2]), 1) if temp_stats[2] else 0,
                    'max': round(float(temp_stats[3]), 1) if temp_stats[3] else 0
                },
                'humidity': {
                    'avg': round(float(temp_stats[4]), 1) if temp_stats[4] else 0
                },
                'events': {
                    'emergencies': int(emerg_count),
                    'messages': int(msg_count)
                }
            }

            return json.dumps({'success': True, 'data': stats})
    except Exception as e:
        print(f"❌ Error fetching stats: {e}")
        return json.dumps({'success': False, 'error': str(e)}), 500

# --- NEW: SENDING MESSAGES ---
# Topic to send text to the Bedside Unit screen
TOPIC_DISPLAY = "home/bedside/comm/display"

@socketio.on('send_message')
def handle_send_message(data):
    """
    Received from Web Browser: {'msg': 'Take Pills', 'color': 'green'}
    """
    print(f"📤 Sending to Device: {data}")

    # 1. Create the JSON payload for M5Stack
    msg_text = data.get('msg', 'Hello')
    payload = json.dumps({
        "msg": msg_text,
        "color": data.get('color', 'white'),
        "duration": 5
    })

    # 2. Publish to MQTT
    client.publish(TOPIC_DISPLAY, payload)

    # 3. Store message in database
    insert_commu_data(emerg=False, msg=f"Sent to device: {msg_text}")

if __name__ == '__main__':
    # Initialize database connection pool
    print("🔌 Initializing PostgreSQL connection...")
    if init_db_pool():
        test_connection()
    else:
        print("⚠️ Database initialization failed. Continuing without database support.")

    # Connect to MQTT
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()  # Run MQTT in background thread

    print("🚀 Server running at http://0.0.0.0:8000")

    try:
        socketio.run(app, host='0.0.0.0', port=8000)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down server...")
    finally:
        # Cleanup
        close_db_pool()
        client.loop_stop()
        client.disconnect()
        print("👋 Server stopped")
