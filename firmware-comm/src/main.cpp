#include <M5Core2.h>
#include <ArduinoJson.h>
#include <SharedIoT.h> 

// --- UNIT CONFIGURATION ---
const char* UNIT_NAME = "Bedside_Comm_Unit";

// --- TOPICS ---
const char* TOPIC_DISPLAY = "home/bedside/comm/display"; // Incoming messages
const char* TOPIC_BUTTON  = "home/bedside/comm/button";  // Outgoing alerts
const char* TOPIC_STATUS  = "home/bedside/comm/status";  // Heartbeat

// --- GLOBAL OBJECTS ---
WiFiClient espClient;
PubSubClient client(espClient);

// --- CALLBACK FUNCTION ---
void callback(char* topic, byte* payload, unsigned int length) {
    Serial.print("Msg received on [");
    Serial.print(topic);
    Serial.print("]: ");

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload, length);

    if (error) {
        Serial.print("JSON Error: ");
        Serial.println(error.c_str());
        return;
    }

    const char* msg = doc["msg"]; 
    const char* color = doc["color"]; 

    // Visual Alert
    M5.Lcd.fillScreen(BLACK);

    if (color && strcmp(color, "red") == 0) {
        M5.Lcd.setTextColor(RED);
    } else if (color && strcmp(color, "green") == 0) {
        M5.Lcd.setTextColor(GREEN);
    } else {
        M5.Lcd.setTextColor(WHITE);
    }

    M5.Lcd.setTextSize(3);
    M5.Lcd.setCursor(10, 50);
    M5.Lcd.println(msg);

    // Buzz Logic
    M5.Axp.SetLDOEnable(3, true); 
    delay(500);
    M5.Axp.SetLDOEnable(3, false);
}

// --- SETUP ---
void setup() {
    M5.begin(true, true, true, true);
    M5.Lcd.setTextSize(2);

    // 1. Connect Wi-Fi (Shared Lib)
    setup_wifi(UNIT_NAME);

    // 2. Configure MQTT 
    client.setServer(MQTT_HOST, MQTT_PORT);
    client.setCallback(callback);
}

// --- LOOP ---
void loop() {
    // 1. Connection Logic
    if (!client.connected()) {
        ensure_mqtt(client, UNIT_NAME);
        // Resubscribe on reconnect
        if (client.connected()) {
            Serial.println("Reconnected! Subscribing...");
            client.subscribe(TOPIC_DISPLAY);
        }
    }

    // 2. MQTT Housekeeping
    client.loop();

    // 3. Hardware Updates
    M5.update(); 

    // 4. SHARED HEARTBEAT (Every 30s)
    // This keeps the dashboard from showing "OFFLINE"
    send_heartbeat(client, UNIT_NAME, TOPIC_STATUS);

    // 5. Button Logic (Call for Help)
    if (M5.BtnA.wasPressed()) {
        StaticJsonDocument<200> doc;
        doc["unit_id"] = UNIT_NAME;
        doc["event"] = "CALL_FOR_HELP";
        doc["priority"] = "HIGH";

        char buffer[256];
        serializeJson(doc, buffer);

        Serial.println("Sending Help Alert...");
        client.publish(TOPIC_BUTTON, buffer);

        M5.Lcd.fillScreen(RED);
        M5.Lcd.setCursor(20, 100);
        M5.Lcd.setTextColor(WHITE);
        M5.Lcd.println("CALLING...");
        delay(2000);
        M5.Lcd.fillScreen(BLACK);
    }
}
