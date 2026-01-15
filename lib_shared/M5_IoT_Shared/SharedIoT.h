#ifndef SHARED_IOT_H
#define SHARED_IOT_H

#include <M5Core2.h>
#include <WiFi.h>
#include <PubSubClient.h>

// --- DECLARATIONS ONLY (No Values Here!) ---
extern const char* WIFI_SSID;
extern const char* WIFI_PASS;
extern const char* MQTT_HOST;
extern const int   MQTT_PORT;

// --- FUNCTIONS ---
void setup_wifi(const char* device_name);
void ensure_mqtt(PubSubClient& client, const char* client_id);

#endif
