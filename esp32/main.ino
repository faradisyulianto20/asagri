#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_SHT31.h>

#include <WiFi.h>
#include <HTTPClient.h>

// --- KONFIGURASI WIFI & SERVER ---
const char* WIFI_SSID = "NAMA_WIFI_ANDA";
const char* WIFI_PASS = "PASSWORD_WIFI";
const char* API_URL = "https://asagri-production.up.railway.app/api/sensor";
const char* API_TOKEN = "t5843a85ce83ea39c6b7013157e135c8cb2508bc246c6111fd15e5ae13a6af6a7";

// --- TIMER & INTERVAL ---
unsigned long previousMillis = 0;
const long interval = 2000;      // Interval pembacaan sensor 2 detik
unsigned long sendMillis = 0;
const long sendInterval = 10000; // Kirim data ke server tiap 10 detik

// Inisialisasi LCD (Alamat I2C umum: 0x27 atau 0x3F)
LiquidCrystal_I2C lcd(0x27, 16, 2);
Adafruit_SHT31 sht31 = Adafruit_SHT31();

// Pin Relay 4 Channel (Sesuai konfigurasi ESP32)
const int in1 = 13; // Relay 1 (Kontrol Suhu / Kipas)
const int in2 = 12; // Relay 2 (Kontrol Kelembaban / Humidifier)
const int in3 = 14; // Relay 3 (Standby)
const int in4 = 27; // Relay 4 (Standby)

// Pin Buzzer (Dipindah ke GPIO 18)
const int buzzerPin = 18;

void setup() {
  Serial.begin(115200);
  delay(500); // Jeda singkat agar serial stabil saat booting

  // --- HUBUNGKAN WIFI ---
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Menghubungkan WiFi");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 15000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi terhubung, IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi gagal, akan coba lagi di loop()");
  }

  // Inisialisasi komunikasi I2C dan LCD
  Wire.begin();
  lcd.init();
  lcd.backlight();

  // Tampilan awal saat menyala
  lcd.setCursor(0, 0);
  lcd.print("Menginisialisasi");
  lcd.setCursor(0, 1);
  lcd.print("System Ready...");
  delay(1500);

  // Cek apakah Sensor SHT31 terhubung
  if (!sht31.begin(0x44)) {
    Serial.println("Sensor SHT31 tidak ditemukan!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SHT31 Error!");
    lcd.setCursor(0, 1);
    lcd.print("Periksa Kabel!");
    while (1) delay(1); // Mengunci program jika sensor rusak/lepas
  }

  // Set semua Pin Relay sebagai OUTPUT
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
  pinMode(in3, OUTPUT);
  pinMode(in4, OUTPUT);

  // Set Pin Buzzer sebagai OUTPUT
  pinMode(buzzerPin, OUTPUT);

  // Kondisi awal semua Relay OFF (HIGH = Mati untuk modul relay active-low)
  digitalWrite(in1, HIGH);
  digitalWrite(in2, HIGH);
  digitalWrite(in3, HIGH);
  digitalWrite(in4, HIGH);

  // Kondisi awal Buzzer OFF
  digitalWrite(buzzerPin, LOW);

  lcd.clear();
}

// Kirim data sensor ke backend via HTTPS POST
void kirimData(float t, float h) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Token", API_TOKEN);
  http.setInsecure(true); // HTTPS tanpa verifikasi sertifikat (memakai domain .up.railway.app)

  String payload = "{\"temperature\":" + String(t, 1) +
                   ",\"humidity\":" + String(h, 1) +
                   ",\"relay_fan\":" + String(digitalRead(in1) == LOW ? "true" : "false") +
                   ",\"relay_humidifier\":" + String(digitalRead(in2) == LOW ? "true" : "false") +
                   ",\"relay_3\":" + String(digitalRead(in3) == LOW ? "true" : "false") +
                   ",\"relay_4\":" + String(digitalRead(in4) == LOW ? "true" : "false") +
                   ",\"buzzer\":" + String(digitalRead(buzzerPin) == HIGH ? "true" : "false") + "}";

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.print("Kirim OK (HTTP ");
    Serial.print(httpCode);
    Serial.println(")");
  } else {
    Serial.print("Kirim gagal: ");
    Serial.println(http.errorToString(httpCode));
  }
  http.end();
}

void loop() {
  unsigned long currentMillis = millis();

  // Coba sambungkan ulang WiFi jika putus
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi putus, menghubungkan ulang...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    delay(500);
    return;
  }

  // Jalankan pembacaan sensor setiap 'interval' (2 detik)
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Membaca data suhu dan kelembaban dari SHT31
    float t = sht31.readTemperature();
    float h = sht31.readHumidity();

    // Validasi apakah sensor berhasil dibaca
    if (!isnan(t) && !isnan(h)) {

      // --- 1. LOGIKA OTOMATIS RELAY ---
      if (t >= 32.0) {
        digitalWrite(in1, LOW);  // Relay 1 ON (Kipas Nyala)
      } else if (t <= 25.0) {
        digitalWrite(in1, HIGH); // Relay 1 OFF (Kipas Mati)
      }

      if (h <= 61.0) {
        digitalWrite(in2, LOW);  // Relay 2 ON (Humidifier Nyala)
      } else if (h >= 83.0) {
        digitalWrite(in2, HIGH); // Relay 2 OFF (Humidifier Mati)
      }

      // --- 2. LOGIKA ALARM BAHAYA ---
      if (t > 40.0 || h < 50.0) {
        digitalWrite(buzzerPin, HIGH); // Buzzer Menyala
        Serial.println("!!! PERINGATAN: Kondisi Ekstrim Terdeteksi !!!");
      } else {
        digitalWrite(buzzerPin, LOW);  // Buzzer Mati
      }

      // --- 3. MENAMPILKAN DATA KE LCD ---
      lcd.setCursor(0, 0);
      lcd.print("Suhu : ");
      lcd.print(t, 1);
      lcd.write(0xDF);
      lcd.print("C  ");

      lcd.setCursor(0, 1);
      lcd.print("Humid: ");
      lcd.print(h, 1);
      lcd.print(" %  ");

      // Cetak ke Serial Monitor
      Serial.print("Suhu: ");
      Serial.print(t, 1);
      Serial.print("°C | ");
      Serial.print("Kelembaban: ");
      Serial.print(h, 1);
      Serial.println("%");

      // --- 4. KIRIM KE BACKEND (tiap 10 detik) ---
      if (currentMillis - sendMillis >= sendInterval) {
        sendMillis = currentMillis;
        kirimData(t, h);
      }

    } else {
      // Antisipasi jika kabel sensor longgar atau error
      Serial.println("Gagal membaca sensor SHT31!");
      digitalWrite(buzzerPin, HIGH);
      lcd.setCursor(0, 0);
      lcd.print("Sensor Error!   ");
      lcd.setCursor(0, 1);
      lcd.print("Periksa Kabel   ");
    }
  }
}
