#include <M5Core2.h>
#include <WiFi.h>

// 1. Include PubSubClient AFTER WiFi
#include <PubSubClient.h> 
#include <ArduinoJson.h>

// --- CONFIGURATION ---
const char* ssid     = "Pawee-iphone";     // <--- EDIT THIS
const char* password = "05237wifi"; // <--- EDIT THIS
const char* mqtt_server = "172.20.10.13"; // <--- EDIT THIS (Your PC IP)
// --- CONFIGURATION ---
/*
const char* ssid     = "aterm-3465e4-g";     // <--- EDIT THIS
const char* password = "5dc0fc9134eee"; // <--- EDIT THIS
const char* mqtt_server = "192.168.10.106"; // <--- EDIT THIS (Your PC IP)
*/


WiFiClient espClient;
PubSubClient client(espClient);

// --- FUNCTIONS ---

void setup_wifi() {
    delay(10);
    M5.Lcd.print("WiFi: ");
    M5.Lcd.println(ssid);
    
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    Serial.println("\nWiFi Connected");
    M5.Lcd.println("WiFi Connected!");
    M5.Lcd.print("IP: ");
    M5.Lcd.println(WiFi.localIP());
}

void reconnect() {
    // Loop until we're reconnected
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection...");
        
        // Generate a simple ID
        String clientId = "M5Stack-Core2-";
        clientId += String(random(0xffff), HEX);

        // Attempt to connect
        if (client.connect(clientId.c_str())) {
            Serial.println("connected");
            M5.Lcd.println("MQTT Broker Connected!");
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" try again in 5s");
            delay(5000);
        }
    }
}

void setup() {
    // Initialize M5Stack Core2
    M5.begin(true, true, true, true);
    M5.Lcd.setTextSize(2);
    
    setup_wifi();
    
    // Configure MQTT
    client.setServer(mqtt_server, 1883);
}

void loop() {
    // Maintain Connection
    if (!client.connected()) {
        reconnect();
    }
    client.loop();

    // Prepare Data
    StaticJsonDocument<200> doc;
    doc["device"] = "M5Core2";
    doc["voltage"] = M5.Axp.GetBatVoltage();
    doc["status"] = "Active";

    char buffer[256];
    serializeJson(doc, buffer);

    // Publish Data
    Serial.println("Publishing...");
    client.publish("m5stack/data", buffer);

    // Wait 5 seconds
    delay(5000);
}
