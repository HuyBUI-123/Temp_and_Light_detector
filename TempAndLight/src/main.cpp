#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

#include "secrets.h"

// Config

// Pins
#define DHT_PIN   4      // DHT22 data
#define DHT_TYPE  DHT22
#define LIGHT_PIN 34     // Analog light sensor

// OLED
#define OLED_WIDTH   128
#define OLED_HEIGHT  64
#define OLED_ADDR    0x3C

// Timing (milliseconds)
static const unsigned long DISPLAY_INTERVAL = 1000;   // refresh numbers
static const unsigned long POST_INTERVAL    = 30000;  // send to backend
static const unsigned long WIFI_RETRY        = 10000; // reconnect attempt time


// If your module reads HIGH in the dark and LOW in bright light, set this true.
static const bool LIGHT_INVERT = false;

// Globals

Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
DHT dht(DHT_PIN, DHT_TYPE);

// Latest readings (kept between reads so the display holds the last good value).
float lastTemp     = NAN;
float lastHumidity = NAN;
int   lastLightRaw = 0;
float lastLightPct = 0.0f;

unsigned long lastDisplayMs = 0;
unsigned long lastPostMs    = 0;
unsigned long lastWifiTryMs = 0;

// Display layout: labels + units are drawn ONCE; only the number cells are
// rewritten each second. Each number lives in a fixed rectangle that we clear
// before writing, so a shorter value can never leave ghost pixels behind.
static const int VAL_X   = 42;  // left edge of the number cell
static const int UNIT_X  = 86;  // left edge of the unit glyph (drawn once)
static const int ROW_T   = 0;   // temperature row (top)
static const int ROW_H   = 16;  // humidity row
static const int ROW_L   = 32;  // light row
static const int ROW_NET = 50;  // wifi status row (small font)
static const int CELL_W  = UNIT_X - VAL_X - 2;  // number cell width
static const int CELL_H  = 16;                  // size-2 glyph height

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

// Draw the parts that never change: labels down the left, units on the right.
void drawStaticLayout() {
  display.clearDisplay();

  display.setTextColor(SSD1306_WHITE);

  // Labels (small font, vertically nudged to sit next to the big numbers).
  display.setTextSize(1);
  display.setCursor(0, ROW_T + 4);  display.print("TEMP");
  display.setCursor(0, ROW_H + 4);  display.print("HUM");
  display.setCursor(0, ROW_L + 4);  display.print("LIGHT");

  // Units (small font).
  display.setCursor(UNIT_X, ROW_T + 4);  display.print("C");
  display.setCursor(UNIT_X, ROW_H + 4);  display.print("%");
  display.setCursor(UNIT_X, ROW_L + 4);  display.print("%");

  display.display();
}

// Rewrite one number cell in the big font. Value is zero-padded to 2 digits
// (values >= 100, e.g. light at 100%, simply take a third digit). The cell is
// cleared first so no leftover pixels remain from a wider previous value.
void drawValueCell(int rowY, int value, bool valid) {
  display.fillRect(VAL_X, rowY, CELL_W, CELL_H, SSD1306_BLACK);
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(VAL_X, rowY);

  char buf[8];
  if (valid) {
    snprintf(buf, sizeof(buf), "%02d", value);
  } else {
    snprintf(buf, sizeof(buf), "--");
  }
  display.print(buf);
}

// Small status line at the bottom for connection state.
void drawNetStatus(const char *msg) {
  display.fillRect(0, ROW_NET, OLED_WIDTH, 14, SSD1306_BLACK);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, ROW_NET + 3);
  display.print(msg);
}

// ---------------------------------------------------------------------------
// WiFi
// ---------------------------------------------------------------------------

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiTryMs < WIFI_RETRY && lastWifiTryMs != 0) return;
  lastWifiTryMs = now;

  Serial.printf("WiFi: connecting to \"%s\"...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Give it a short blocking window; loop() will retry if it doesn't take.
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi: connected, IP = ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi: not connected (will retry).");
  }
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

void postReading() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("POST skipped: no WiFi.");
    return;
  }
  // Don't send junk if we've never had a valid DHT read.
  if (isnan(lastTemp) || isnan(lastHumidity)) {
    Serial.println("POST skipped: no valid sensor reading yet.");
    return;
  }

  char body[256];
  snprintf(body, sizeof(body),
           "{\"device_id\":\"%s\","
           "\"temperature\":%.1f,"
           "\"humidity\":%.1f,"
           "\"light_raw\":%d,"
           "\"light_percent\":%.1f}",
           DEVICE_ID, lastTemp, lastHumidity, lastLightRaw, lastLightPct);

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.setConnectTimeout(4000);
  http.setTimeout(4000);

  int code = http.POST((uint8_t *)body, strlen(body));
  if (code > 0) {
    Serial.printf("POST %s -> %d\n", BACKEND_URL, code);
  } else {
    Serial.printf("POST failed: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

// ---------------------------------------------------------------------------
// Sensors
// ---------------------------------------------------------------------------

void readSensors() {
  float t = dht.readTemperature();  // Celsius
  float h = dht.readHumidity();
  if (!isnan(t)) lastTemp = t;          // keep last good value on failure
  if (!isnan(h)) lastHumidity = h;

  int raw = analogRead(LIGHT_PIN);
  float pct = (raw / 4095.0f) * 100.0f;
  if (LIGHT_INVERT) pct = 100.0f - pct;
  lastLightRaw = raw;
  lastLightPct = pct;
}

// ---------------------------------------------------------------------------
// setup / loop
// ---------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nTemp & Light detector starting...");

  analogReadResolution(12);  // 0..4095

  Wire.begin();  // SDA=21, SCL=22 by default on ESP32
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("SSD1306 not found — check wiring / I2C address (0x3C vs 0x3D).");
    // Continue anyway; sensors + POST still work without the screen.
  } else {
    drawStaticLayout();
  }

  dht.begin();
  ensureWifi();

  // Prime a first reading so the screen isn't blank.
  readSensors();
}

void loop() {
  unsigned long now = millis();

  ensureWifi();

  if (now - lastDisplayMs >= DISPLAY_INTERVAL) {
    lastDisplayMs = now;

    readSensors();

    bool tempOk = !isnan(lastTemp);
    bool humOk  = !isnan(lastHumidity);
    drawValueCell(ROW_T, (int)roundf(lastTemp),     tempOk);
    drawValueCell(ROW_H, (int)roundf(lastHumidity), humOk);
    drawValueCell(ROW_L, (int)roundf(lastLightPct), true);

    if (WiFi.status() == WL_CONNECTED) {
      String s = "WiFi " + WiFi.localIP().toString();
      drawNetStatus(s.c_str());
    } else {
      drawNetStatus("WiFi: offline");
    }

    display.display();  // push the buffer; labels/units are untouched
  }

  if (now - lastPostMs >= POST_INTERVAL) {
    lastPostMs = now;
    postReading();
  }
}
