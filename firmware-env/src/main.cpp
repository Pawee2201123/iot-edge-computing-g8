#include <M5Core2.h>
#include <SharedIoT.h>
#include <ArduinoJson.h>
#include "M5UnitENV.h" 

// --- CONFIG ---
const char* UNIT_NAME = "Living_Room_Env";
const char* TOPIC_TELEMETRY = "home/living_room/env/telemetry";
const char* TOPIC_STATUS = "home/living_room/env/status"; // Heartbeat Topic

// Define Sensor Objects
SHT3X sht30;        
QMP6988 qmp6988;    

float temp = 0.0;
float hum = 0.0;
float pressure = 0.0;

unsigned long lastMsg = 0;

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
    M5.begin(true, true, true, true);
    
    // Initialize Sensors (Port A = Pins 32, 33)
    if (!qmp6988.begin(&Wire, 0x70, 32, 33, 400000)) {
        Serial.println("Could not find QMP6988!");
        M5.Lcd.println("Sensor Missing!");
        while(1);
    }
    if (!sht30.begin(&Wire, 0x44, 32, 33, 400000)) {
        Serial.println("Could not find SHT30!");
        while(1);
    }
    
    Serial.println("ENV III Found.");
    setup_wifi(UNIT_NAME);
    client.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
    ensure_mqtt(client, UNIT_NAME);
    client.loop();
    
    // 1. SHARED HEARTBEAT (Every 30s)
    send_heartbeat(client, UNIT_NAME, TOPIC_STATUS);

    // 2. Report Sensor Data (Every 5 seconds)
    if (millis() - lastMsg > 5000) {
        lastMsg = millis();

        // Read Data
        if (sht30.update()) {
            temp = sht30.cTemp;
            hum = sht30.humidity;
        }
        if (qmp6988.update()) {
            pressure = qmp6988.pressure;
        }

        // Publish Telemetry
        StaticJsonDocument<256> doc;
        doc["unit_id"] = UNIT_NAME;
        doc["temp"] = temp;
        doc["humidity"] = hum;
        doc["pressure"] = pressure;
        doc["status"] = "Active";
        doc["battery"] = M5.Axp.GetBatVoltage();

        char buffer[256];
        serializeJson(doc, buffer);
        client.publish(TOPIC_TELEMETRY, buffer);
        Serial.println(buffer);

        // Update Screen
        M5.Lcd.fillScreen(BLACK);
        M5.Lcd.setCursor(10, 20);
        M5.Lcd.setTextSize(3);
        M5.Lcd.printf("T: %.1f C\n", temp);
        M5.Lcd.printf("H: %.1f %%\n", hum);
        M5.Lcd.setTextSize(2);
        M5.Lcd.printf("P: %.0f Pa", pressure);
    }
}
