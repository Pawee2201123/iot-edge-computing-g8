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
TOPIC_FALL        = "home/user_belt/safety/alert"
TOPIC_HELP        = "home/bedside/comm/button"
TOPIC_STATUS      = "home/user_belt/safety/status"
TOPIC_ENV         = "home/living_room/env/telemetry"
TOPIC_COMM_STATUS = "home/bedside/comm/status"
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

        # 2. Filter logic
        if topic == TOPIC_FALL:
            print(">>> Sending FALL Alert to Web")
            socketio.emit('alert', {'type': 'FALL', 'data': data})
            
        elif topic == TOPIC_HELP:
            print(">>> Sending HELP Alert to Web")
            socketio.emit('alert', {'type': 'HELP', 'data': data})
            
        elif topic in [TOPIC_STATUS, TOPIC_ENV, TOPIC_COMM_STATUS]:
            socketio.emit('status', data)

    except Exception as e:
        print(f"❌ Error parsing MQTT: {e}")

client.on_connect = on_connect
client.on_message = on_message

# --- WEB ROUTES ---
@app.route('/')
def index():
    return render_template('index.html')
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
    payload = json.dumps({
        "msg": data.get('msg', 'Hello'),
        "color": data.get('color', 'white'),
        "duration": 5
    })
    
    # 2. Publish to MQTT
    client.publish(TOPIC_DISPLAY, payload)

if __name__ == '__main__':
    # connect to MQTT
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start() # Run MQTT in background thread
    
    print("🚀 Server running at http://0.0.0.0:8000")
    socketio.run(app, host='0.0.0.0', port=8000)
