#include <M5Core2.h>
#include <SharedIoT.h> // Reuse your Wi-Fi/MQTT code!
#include <ArduinoJson.h>

// --- CONFIGURATION ---
const char* UNIT_NAME = "Belt_Fall_Detector";
const char* TOPIC_ALERT = "home/user_belt/safety/alert";
const char* TOPIC_STATUS = "home/user_belt/safety/status";

// Thresholds
const float FALL_THRESHOLD_G = 2.5; // Trigger if G-force > 2.5G
unsigned long lastTelemetryTime = 0;

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
    M5.begin(true, true, true, true);
    M5.IMU.Init(); // Start the Accelerometer
    
    // Visuals
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(10, 10);
    M5.Lcd.println("Fall Detector ACTIVE");

    // Connect using Shared Library
    setup_wifi(UNIT_NAME);
    client.setServer(MQTT_HOST, MQTT_PORT);
}

void send_alert(float g_force) {
    StaticJsonDocument<200> doc;
    doc["unit_id"] = UNIT_NAME;
    doc["event"] = "FALL_DETECTED";
    doc["priority"] = "CRITICAL";
    doc["g_force"] = g_force;
    
    char buffer[256];
    serializeJson(doc, buffer);
    
    client.publish(TOPIC_ALERT, buffer);
    Serial.println("!!! FALL DETECTED SENT !!!");
    
    // Local Alarm
    M5.Lcd.fillScreen(RED);
    M5.Lcd.setCursor(20, 50);
    M5.Lcd.setTextSize(3);
    M5.Lcd.println("FALL!");
    
    M5.Axp.SetLDOEnable(3, true); // Vibrate
    delay(1000);
    M5.Axp.SetLDOEnable(3, false);
    
    M5.Lcd.fillScreen(BLACK);
}

void loop() {
    // 1. Keep Connection Alive
    ensure_mqtt(client, UNIT_NAME);
    client.loop();

    // 2. Read Physics (High Speed)
    float accX, accY, accZ;
    M5.IMU.getAccelData(&accX, &accY, &accZ);
    
    // Calculate Vector Sum (Total G-Force)
    // We use sqrt(x^2 + y^2 + z^2)
    float total_g = sqrt((accX * accX) + (accY * accY) + (accZ * accZ));

    // 3. Check for Fall
    if (total_g > FALL_THRESHOLD_G) {
        Serial.print("Impact detected: ");
        Serial.println(total_g);
        send_alert(total_g);
        
        // Debounce: Wait 2 seconds so we don't send 50 alerts for one bounce
        delay(2000); 
    }

    // 4. Send Heartbeat (Every 10 seconds)
    // Just so the server knows the battery didn't die
    if (millis() - lastTelemetryTime > 10000) {
        lastTelemetryTime = millis();
        
        StaticJsonDocument<200> doc;
        doc["unit_id"] = UNIT_NAME;
        doc["status"] = "monitoring";
        doc["battery"] = M5.Axp.GetBatVoltage();
        
        char buffer[256];
        serializeJson(doc, buffer);
        client.publish(TOPIC_STATUS, buffer);
    }
    
    // Small delay to prevent CPU overheating, but fast enough to catch falls
    delay(20); 
}
