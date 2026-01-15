import paho.mqtt.client as mqtt
import json

# Configuration
BROKER = "127.0.0.1"  # Localhost (since the server is on the same machine)
TOPIC_DATA = "m5stack/data"

def on_connect(client, userdata, flags, rc):
    print(f"Connected to Broker (Code: {rc})")
    # Subscribe to the topic immediately upon connecting
    client.subscribe(TOPIC_DATA)
    print(f"Listening on topic: {TOPIC_DATA}")

def on_message(client, userdata, msg):
    try:
        # Decode the JSON payload
        payload = msg.payload.decode()
        data = json.loads(payload)
        
        print("\n--- INCOMING TELEMETRY ---")
        print(f"Device:  {data.get('device')}")
        print(f"Voltage: {data.get('voltage')} V")
        print(f"Raw:     {payload}")
        
    except Exception as e:
        print(f"Error parsing message: {e}")

# Setup Client
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

# Connect
print("Connecting to Broker...")
client.connect(BROKER, 1883, 60)

# Run forever
client.loop_forever()
