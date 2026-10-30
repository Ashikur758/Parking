/*
  SmartPark - ESP32 <-> Firebase Realtime Database <-> Web
  সব ৮টি IR sensor (A01-A04, B01-B04) কাজ করবে।

  Libraries (Library Manager):
    - Firebase ESP Client   (by Mobizt)
    - ESP32Servo            (by Kevin Harrington)
    - LiquidCrystal I2C     (by Frank de Brabander)

  Firebase structure:
    gate/open                  : true / false   (Web লেখে, ESP32 পড়ে)
    slots/<A01..B04>           : occupied, entryDate, entryTime, entryEpoch,
                                 exitDate, exitTime, historyKey
    history/<pushId>           : slotId, entryDate, entryTime, entryEpoch,
                                 exitDate, exitTime, exitEpoch,
                                 durationSeconds, vehicleNo
    status/vehiclesInside      : number (0-8)

  স্লট LED: Green = খালি, Red = গাড়ি আছে (LED_GREEN / LED_RED অ্যারে দেখুন)
*/

#include <WiFi.h>
#include <time.h>
#include <Firebase_ESP_Client.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

/* ---------- আপনার তথ্য দিন ---------- */
#define WIFI_SSID      "YOUR_WIFI_NAME"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"

#define API_KEY        "AIzaSyDyjvcDguIlT3tcqW94BgIx4Txcc2MyM4Q"
// Firebase Console > Realtime Database পেজের URL (শেষে / ছাড়া)
#define DATABASE_URL   "https://smart-parking-system-7d24a-default-rtdb.firebaseio.com"

/* ---------- ৮টি IR sensor পিন ----------
   A01=34, A02=35, A03=36, A04=39, B01=32, B02=33, B03=25, B04=26
   (34, 35, 36, 39 শুধু input পিন, IR মডিউলের OUT সরাসরি লাগানো যাবে) */
#define N_SLOTS 8
const int   IR_PIN[N_SLOTS]   = {34, 35, 36, 39, 32, 33, 25, 26};
const char* SLOT_ID[N_SLOTS]  = {"A01", "A02", "A03", "A04", "B01", "B02", "B03", "B04"};

#define SERVO_PIN          18
#define IR_ACTIVE_LOW      true         // বেশিরভাগ IR মডিউলে বাধা পেলে LOW দেয়

#define GATE_OPEN_ANGLE    90
#define GATE_CLOSED_ANGLE  0
#define DEBOUNCE_MS        1000
#define GATE_POLL_MS       1000

/* ---------- স্লটের Red / Green LED (৫ জোড়া) ----------
   Green জ্বলবে = স্লট খালি,  Red জ্বলবে = স্লটে গাড়ি আছে
   প্রতিটি LED এর সাথে 220 ohm রেজিস্টর দিয়ে GND এ লাগান।
   -1 মানে ওই স্লটে LED নেই। আপনার LED যে স্লটে লাগাবেন সেই স্লটের জায়গায় পিন বসান।
                      A01  A02  A03  A04  B01  B02  B03  B04  */
const int LED_GREEN[N_SLOTS] = {27,  13,  17,   5,  15,  -1,  -1,  -1};
const int LED_RED[N_SLOTS]   = {14,  16,   4,  23,   2,  -1,  -1,  -1};

/* ---------- I2C LCD (16x2) ও Buzzer ----------
   LCD: SDA = GPIO 21, SCL = GPIO 22, VCC = 5V, GND = GND
   Buzzer (3 pin): VCC, GND, SIGNAL = GPIO 19                    */
#define LCD_ADDR           0x27     // না চললে 0x3F দিয়ে দেখুন
#define LCD_COLS           16
#define LCD_ROWS           2
#define I2C_SDA            21
#define I2C_SCL            22
#define SCREEN_MS          5000     // ৫ সেকেন্ড পর পর স্ক্রিন বদলাবে

#define BUZZER_PIN         19
#define BUZZER_ACTIVE_LOW  false    // মডিউল LOW সিগন্যালে বাজলে true করুন

/* ---------- সময়: বাংলাদেশ UTC+6 ---------- */
const long GMT_OFFSET_SEC = 6 * 3600;

FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;
Servo          gateServo;

String        activeKey[N_SLOTS];
int           candidate[N_SLOTS];
int           stableState[N_SLOTS];
unsigned long changedAt[N_SLOTS];
unsigned long retryAt[N_SLOTS];
bool          gateOpen     = false;
unsigned long lastGatePoll = 0;

bool occNow[N_SLOTS];   // debounce করা বর্তমান অবস্থা (LED, LCD, Buzzer এর জন্য)

void setLed(int i, bool occupied) {
  if (LED_GREEN[i] >= 0) digitalWrite(LED_GREEN[i], occupied ? LOW  : HIGH);
  if (LED_RED[i]   >= 0) digitalWrite(LED_RED[i],   occupied ? HIGH : LOW);
}

LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);
int           screenNo         = 0;   // 0 = Welcome, 1 = Free Slot
unsigned long lastScreenSwitch = 0;

void buzzerWrite(bool on) {
  digitalWrite(BUZZER_PIN, (on ^ BUZZER_ACTIVE_LOW) ? HIGH : LOW);
}

void beep(int times, int ms) {
  for (int k = 0; k < times; k++) {
    buzzerWrite(true);
    delay(ms);
    buzzerWrite(false);
    if (k < times - 1) delay(ms);
  }
}

// লেখা LCD-র মাঝখানে বসায়
void lcdLine(int row, String text) {
  if ((int)text.length() > LCD_COLS) text = text.substring(0, LCD_COLS);
  int pad = (LCD_COLS - (int)text.length()) / 2;
  String line = "";
  for (int k = 0; k < pad; k++) line += ' ';
  line += text;
  while ((int)line.length() < LCD_COLS) line += ' ';
  lcd.setCursor(0, row);
  lcd.print(line);
}

int freeInZone(char zone) {
  int f = 0;
  for (int i = 0; i < N_SLOTS; i++) {
    if (SLOT_ID[i][0] == zone && !occNow[i]) f++;
  }
  return f;
}

void showScreen() {
  if (screenNo == 0) {
    lcdLine(0, "Welcome");
    lcdLine(1, "Entry Gate");
  } else {
    lcdLine(0, "Free Slot");
    lcdLine(1, "ZoneA:" + String(freeInZone('A')) + " ZoneB:" + String(freeInZone('B')));
  }
}

bool readOccupied(int i) {
  int v = digitalRead(IR_PIN[i]);
  return IR_ACTIVE_LOW ? (v == LOW) : (v == HIGH);
}

bool getNow(time_t &now, String &dateStr, String &timeStr) {
  now = time(nullptr);
  if (now < 1700000000) return false;   // সময় এখনো sync হয়নি

  struct tm ti;
  localtime_r(&now, &ti);

  char buf[12];
  strftime(buf, sizeof(buf), "%Y-%m-%d", &ti);
  dateStr = buf;
  strftime(buf, sizeof(buf), "%H:%M:%S", &ti);
  timeStr = buf;
  return true;
}

void updateStatus() {
  int n = 0;
  for (int i = 0; i < N_SLOTS; i++) if (stableState[i] == 1) n++;
  Firebase.RTDB.setInt(&fbdo, "/status/vehiclesInside", n);
}

/* গাড়ি ঢুকলে: history তৈরি + slots আপডেট */
bool slotOccupied(int i) {
  String id = SLOT_ID[i];

  if (activeKey[i].length() == 0) {
    time_t now; String d, t;
    if (!getNow(now, d, t)) return false;

    FirebaseJson h;
    h.set("slotId", id);
    h.set("occupied", true);
    h.set("entryDate", d);
    h.set("entryTime", t);
    h.set("entryEpoch", (int)now);
    h.set("vehicleNo", "Unknown");

    if (!Firebase.RTDB.pushJSON(&fbdo, "/history", &h)) {
      Serial.println(fbdo.errorReason());
      return false;
    }
    activeKey[i] = fbdo.pushName();

    FirebaseJson s;
    s.set("occupied", true);
    s.set("entryDate", d);
    s.set("entryTime", t);
    s.set("entryEpoch", (int)now);
    s.set("exitDate", "");
    s.set("exitTime", "");
    s.set("historyKey", activeKey[i]);

    return Firebase.RTDB.updateNode(&fbdo, "/slots/" + id, &s);
  }

  // রিবুটের পরেও গাড়ি আগের মতোই আছে: নতুন history না বানিয়ে চালিয়ে যাবে
  FirebaseJson s;
  s.set("occupied", true);
  return Firebase.RTDB.updateNode(&fbdo, "/slots/" + id, &s);
}

/* গাড়ি বের হলে: history এ Exit Time + Parking Time লেখা */
bool slotFree(int i) {
  String id = SLOT_ID[i];
  FirebaseJson s;
  s.set("occupied", false);

  if (activeKey[i].length() > 0) {
    time_t now; String d, t;
    if (!getNow(now, d, t)) return false;

    long entry = (long)now;
    if (Firebase.RTDB.getInt(&fbdo, "/history/" + activeKey[i] + "/entryEpoch")) {
      entry = fbdo.intData();
    }

    FirebaseJson h;
    h.set("occupied", false);
    h.set("exitDate", d);
    h.set("exitTime", t);
    h.set("exitEpoch", (int)now);
    h.set("durationSeconds", (int)max(0L, (long)now - entry));

    if (!Firebase.RTDB.updateNode(&fbdo, "/history/" + activeKey[i], &h)) {
      Serial.println(fbdo.errorReason());
      return false;
    }

    activeKey[i] = "";
    s.set("exitDate", d);
    s.set("exitTime", t);
    s.set("historyKey", "");
  }

  return Firebase.RTDB.updateNode(&fbdo, "/slots/" + id, &s);
}

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);
  buzzerWrite(false);

  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcdLine(0, "SmartPark");
  lcdLine(1, "Starting...");

  for (int i = 0; i < N_SLOTS; i++) {
    pinMode(IR_PIN[i], INPUT);
    activeKey[i]   = "";
    candidate[i]   = -1;
    stableState[i] = -1;
    changedAt[i]   = 0;
    retryAt[i]     = 0;

    if (LED_GREEN[i] >= 0) pinMode(LED_GREEN[i], OUTPUT);
    if (LED_RED[i]   >= 0) pinMode(LED_RED[i],   OUTPUT);
    occNow[i] = readOccupied(i);
    setLed(i, occNow[i]);
  }

  gateServo.setPeriodHertz(50);
  gateServo.attach(SERVO_PIN, 500, 2400);
  gateServo.write(GATE_CLOSED_ANGLE);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println("\nWiFi connected");

  configTime(GMT_OFFSET_SEC, 0, "pool.ntp.org", "time.google.com");
  for (int k = 0; k < 30 && time(nullptr) < 1700000000; k++) delay(500);

  config.api_key      = API_KEY;
  config.database_url = DATABASE_URL;

  // Authentication ছাড়া (Rules এ ".read"/".write": true থাকতে হবে)
  config.signer.test_mode = true;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  for (int k = 0; k < 40 && !Firebase.ready(); k++) delay(250);

  // রিবুটের আগে চলমান parking session থাকলে সেটি ফিরিয়ে আনা
  for (int i = 0; i < N_SLOTS; i++) {
    if (Firebase.RTDB.getString(&fbdo, String("/slots/") + SLOT_ID[i] + "/historyKey")) {
      activeKey[i] = fbdo.stringData();
    }
  }

  beep(1, 200);                 // সিস্টেম প্রস্তুত
  screenNo = 0;
  lastScreenSwitch = millis();
  showScreen();
}

void loop() {
  /* ---- LCD: ৫ সেকেন্ড পর পর Welcome <-> Free Slot ---- */
  if (millis() - lastScreenSwitch >= SCREEN_MS) {
    lastScreenSwitch = millis();
    screenNo = 1 - screenNo;
    showScreen();
  }

  /* ---- ৮টি IR sensor -> Firebase ---- */
  for (int i = 0; i < N_SLOTS; i++) {
    int raw = readOccupied(i) ? 1 : 0;

    if (raw != candidate[i]) {
      candidate[i] = raw;
      changedAt[i] = millis();
    }

    // LED / LCD / Buzzer: Firebase না থাকলেও সাথে সাথে কাজ করবে
    if (candidate[i] != -1 &&
        (candidate[i] == 1) != occNow[i] &&
        millis() - changedAt[i] >= DEBOUNCE_MS) {
      occNow[i] = (candidate[i] == 1);
      setLed(i, occNow[i]);
      if (occNow[i]) beep(1, 80);      // গাড়ি ঢুকলে ১টি ছোট বিপ
      showScreen();                    // Free Slot সংখ্যা আপডেট
    }

    if (candidate[i] != stableState[i] &&
        millis() - changedAt[i] >= DEBOUNCE_MS &&
        millis() >= retryAt[i] &&
        Firebase.ready()) {

      bool ok = (candidate[i] == 1) ? slotOccupied(i) : slotFree(i);

      if (ok) {
        stableState[i] = candidate[i];
        updateStatus();
        showScreen();                            // Free Slot সংখ্যা আপডেট
        Serial.printf("%s -> %s\n", SLOT_ID[i], stableState[i] ? "OCCUPIED" : "FREE");
      } else {
        retryAt[i] = millis() + 3000;   // ব্যর্থ হলে ৩ সেকেন্ড পর আবার চেষ্টা
      }
    }
  }

  /* ---- Firebase gate/open (true/false) -> Servo ---- */
  if (millis() - lastGatePoll >= GATE_POLL_MS && Firebase.ready()) {
    lastGatePoll = millis();

    if (Firebase.RTDB.getBool(&fbdo, "/gate/open")) {
      bool want = fbdo.boolData();

      if (want != gateOpen) {
        gateOpen = want;
        gateServo.write(gateOpen ? GATE_OPEN_ANGLE : GATE_CLOSED_ANGLE);
        Serial.println(gateOpen ? "Gate OPEN (true)" : "Gate CLOSED (false)");
        beep(gateOpen ? 1 : 2, 150);            // খুললে ১ বিপ, বন্ধ হলে ২ বিপ
      }
    }
  }

  delay(20);
}
