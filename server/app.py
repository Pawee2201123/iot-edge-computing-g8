import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template
from flask_socketio import SocketIO
import paho.mqtt.client as mqtt
import json

# --- CONFIGURATION ---
MQTT_BROKER = "127.0.0.1"  # It runs on the same machine
MQTT_PORT = 1883

# Topics to listen to
TOPIC_FALL  = "home/user_belt/safety/alert"
TOPIC_HELP  = "home/bedside/comm/button"
TOPIC_STATUS = "home/user_belt/safety/status" # Heartbeats

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- MQTT SETUP ---
client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    print(f"✅ Dashboard Connected to MQTT (Code: {rc})")
    # Subscribe to multiple topics
    client.subscribe([(TOPIC_FALL, 0), (TOPIC_HELP, 0), (TOPIC_STATUS, 0)])

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload_str = msg.payload.decode()
        data = json.loads(payload_str)
        
        print(f"Incoming [{topic}]: {payload_str}")

        # Logic: Decide what to tell the Browser
        if topic == TOPIC_FALL:
            # URGENT: Send Fall Alert
            socketio.emit('alert', {'type': 'FALL', 'data': data})
            
        elif topic == TOPIC_HELP:
            # URGENT: Send Help Alert
            socketio.emit('alert', {'type': 'HELP', 'data': data})
            
        elif topic == TOPIC_STATUS:
            # UPDATE: Just update battery/status on dashboard
            socketio.emit('status', data)

    except Exception as e:
        print(f"Error parsing MQTT: {e}")

client.on_connect = on_connect
client.on_message = on_message

# --- WEB ROUTES ---
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    # connect to MQTT
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start() # Run MQTT in background thread
    
    print("🚀 Server running at http://0.0.0.0:8000")
    socketio.run(app, host='0.0.0.0', port=8000)
