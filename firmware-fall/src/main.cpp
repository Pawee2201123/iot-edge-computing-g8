#include <M5Core2.h>
#include <SharedIoT.h>
#include <ArduinoJson.h>

// --- CONFIGURATION ---
const char* UNIT_NAME = "Belt_Fall_Detector";
const char* TOPIC_ALERT = "home/user_belt/safety/alert";
const char* TOPIC_STATUS = "home/user_belt/safety/status";

// Thresholds
const float FALL_THRESHOLD_G = 2.5; 
unsigned long lastFallTime = 0;      
const int FALL_COOLDOWN = 3000;      // 3 Seconds cooldown between alerts

WiFiClient espClient;
PubSubClient client(espClient);

// --- HELPER FUNCTION ---
void send_alert(float g_force) {
    StaticJsonDocument<200> doc;
    doc["unit_id"] = UNIT_NAME;
    doc["event"] = "FALL_DETECTED";
    doc["priority"] = "CRITICAL";
    doc["g_force"] = g_force;
    doc["battery"] = M5.Axp.GetBatVoltage();
    
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

void setup() {
    M5.begin(true, true, true, true);
    M5.IMU.Init(); // Start Accelerometer
    
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(10, 10);
    M5.Lcd.println("Fall Detector ACTIVE");

    setup_wifi(UNIT_NAME);
    client.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
    // 1. Keep Connection Alive
    ensure_mqtt(client, UNIT_NAME);
    client.loop();

    // 2. SHARED HEARTBEAT (Every 30s)
    send_heartbeat(client, UNIT_NAME, TOPIC_STATUS);

    // 3. Read Physics (High Speed)
    float accX, accY, accZ;
    M5.IMU.getAccelData(&accX, &accY, &accZ);
    
    // Calculate Total G-Force
    float total_g = sqrt((accX * accX) + (accY * accY) + (accZ * accZ));

    // 4. Check for Fall (Non-Blocking)
    if (total_g > FALL_THRESHOLD_G) {
        // Only trigger if outside cooldown window
        if (millis() - lastFallTime > FALL_COOLDOWN) {
            lastFallTime = millis(); 
            Serial.print("Impact detected: ");
            Serial.println(total_g);
            send_alert(total_g);
        }
    }
    
    // 5. Short delay for stability (100Hz sample rate)
    delay(10); 
}
