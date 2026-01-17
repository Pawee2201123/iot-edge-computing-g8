#include "SharedIoT.h"

// --- DEFINITIONS (Values Go Here!) ---
/*
const char* WIFI_SSID = "Pawee-iphone";
const char* WIFI_PASS = "05237wifi";
const char* MQTT_HOST = "172.20.10.13";      
const int   MQTT_PORT = 1883;
*/


const char* WIFI_SSID = "aterm-3465e4-g";
const char* WIFI_PASS = "5dc0fc9134eee";
const char* MQTT_HOST = "192.168.10.106";      
const int   MQTT_PORT = 1883;

void setup_wifi(const char* device_name) {
    delay(10);

    M5.Lcd.print("Connecting to: ");
    M5.Lcd.println(WIFI_SSID);
    
    WiFi.setHostname(device_name);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi Connected");
        M5.Lcd.println("WiFi OK!");
        M5.Lcd.print("IP: ");
        M5.Lcd.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi Failed");
        M5.Lcd.setTextColor(RED);
        M5.Lcd.println("WiFi Failed!");
        M5.Lcd.setTextColor(WHITE);
    }
}

void ensure_mqtt(PubSubClient& client, const char* client_id) {
    if (!client.connected()) {
        Serial.print("Connecting MQTT...");
        // Attempt to connect
        if (client.connect(client_id)) {
            Serial.println("connected");
            M5.Lcd.println("MQTT OK!");
            // IMPORTANT: If you need to re-subscribe to topics on reconnect,
            // do it in the main loop, or pass a callback here.
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" (retrying later)");
        }
    }
}


unsigned long _last_heartbeat_time = 0;
const int HEARTBEAT_INTERVAL = 30000; // 30 Seconds

void send_heartbeat(PubSubClient& client, const char* client_id, const char* topic) {
    if (millis() - _last_heartbeat_time > HEARTBEAT_INTERVAL) {
        _last_heartbeat_time = millis();

        // Create standard status JSON
        StaticJsonDocument<200> doc;
        doc["unit_id"] = client_id;
        doc["status"] = "Active";
        
        // Get Battery Voltage (AXP192 is specific to Core2)
        // Note: For generic ESP32s, this line might need #ifdef checks
        doc["battery"] = M5.Axp.GetBatVoltage();

        char buffer[256];
        serializeJson(doc, buffer);

        // Publish
        if (client.connected()) {
            client.publish(topic, buffer);
            Serial.print("❤️ Shared Heartbeat Sent: ");
            Serial.println(topic);
        }
    }
}
