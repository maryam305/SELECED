#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>

// --- WIFI CREDENTIALS ---
// REPLACE WITH YOUR NETWORK DETAILS
const char* ssid = "Batates";
const char* password = "Kmyamyamya";

Adafruit_MPU6050 mpu;
WebServer server(80);

// Pin 23 is standard for ESP32. 
// If using ESP8266, change this to a valid GPIO (e.g., D1, D2).
#define MOTOR_PIN 23

// Filter coefficient (0.0 -> 1.0)
// 0.98 = 98% from gyro, 2% from accelerometer
const float COMP_FILTER_COEFF = 0.98;

// Time variables for integration (calculating dt)
unsigned long last_time;
float dt;

// Our calculated angles
float angle_pitch = 0.0;
float angle_roll = 0.0;

// "Zero point" offsets
float pitch_offset = 0.0;
float roll_offset = 0.0;

// Global variable to store the final angle for the web server
float current_angle_for_web = 0.0;

// --- CALIBRATION FUNCTION ---
void calibrateSensor() {
  Serial.println("Calibrating... Keep the sensor still!");
  int num_readings = 500;
  float sum_pitch = 0.0;
  float sum_roll = 0.0;

  sensors_event_t a, g, temp;

  for (int i = 0; i < num_readings; i++) {
    mpu.getEvent(&a, &g, &temp);

    // Calculate initial angle from accelerometer
    float acc_pitch = atan2(-a.acceleration.x, sqrt(pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2)));
    float acc_roll = atan2(a.acceleration.y, a.acceleration.z);

    sum_pitch += acc_pitch;
    sum_roll += acc_roll;
    delay(5);
  }

  // Calculate the average offset
  pitch_offset = sum_pitch / num_readings;
  roll_offset = sum_roll / num_readings;

  Serial.println("Calibration Complete!");
  Serial.print("Pitch Offset: "); Serial.println(pitch_offset * RAD_TO_DEG);
  Serial.print("Roll Offset: "); Serial.println(roll_offset * RAD_TO_DEG);
  Serial.println("--------------------------------------");
}

// --- WEB SERVER HANDLERS ---
void handleAngle() {
  // CORS header to allow the web app to access this resource
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  // Create JSON response
  String json = "{\"angle\": " + String(current_angle_for_web) + "}";
  
  server.send(200, "application/json", json);
}

void handleNotFound() {
  if (server.method() == HTTP_OPTIONS) {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(204);
  } else {
    server.send(404, "text/plain", "Not found");
  }
}

void setup(void) {
  Serial.begin(115200);
  pinMode(MOTOR_PIN, OUTPUT);
  
  // Wait for serial monitor to open
  while (!Serial) delay(10); 

  // --- WIFI SETUP ---
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected.");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());

  // --- SENSOR SETUP ---
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip");
    while (1) {
      delay(10);
    }
  }
  Serial.println("MPU6050 Found!");

  // Set ranges
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  delay(100);

  // Calibrate the sensor to set the zero point
  calibrateSensor();

  // --- WEB SERVER SETUP ---
  server.on("/angle", handleAngle);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("HTTP server started");

  // Initialize the time variable
  last_time = micros();
}

void loop() {
  // Handle incoming web requests
  server.handleClient();

  // --- 1. Calculate Delta Time (dt) ---
  unsigned long current_time = micros();
  dt = (current_time - last_time) / 1000000.0; // convert to seconds
  last_time = current_time;

  // --- 2. Get Raw Sensor Data ---
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // --- 3. Calculate Angle from Accelerometer ---
  float acc_pitch = atan2(-a.acceleration.x, sqrt(pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2)));
  float acc_roll = atan2(a.acceleration.y, a.acceleration.z);

  // --- 4. Get Gyro Data ---
  float gyro_pitch_rate = g.gyro.y;
  float gyro_roll_rate = g.gyro.x;

  // --- 5. Apply Complementary Filter ---
  // angle = A * (angle + gyro * dt) + (1 - A) * (accel_angle)
  angle_pitch = COMP_FILTER_COEFF * (angle_pitch + gyro_pitch_rate * dt) + (1.0 - COMP_FILTER_COEFF) * acc_pitch;
  angle_roll = COMP_FILTER_COEFF * (angle_roll + gyro_roll_rate * dt) + (1.0 - COMP_FILTER_COEFF) * acc_roll;

  // --- 6. Apply Calibration Offset and Convert to Degrees ---
  float final_pitch = (angle_pitch - pitch_offset) * RAD_TO_DEG;
  float final_roll = (angle_roll - roll_offset) * RAD_TO_DEG;

  // Update global variable for web server (using roll as the primary posture angle, but could be pitch depending on mounting)
  // Assuming 'roll' is the side-to-side tilt or forward/back depending on orientation. 
  // Let's use the one that changes most significantly. For now, we'll expose 'final_roll' as the main angle.
  // You can change this to final_pitch if the sensor is mounted differently.
  current_angle_for_web = final_roll; 

  // --- 7. Print and Control ---
  // Print less frequently to avoid slowing down the loop too much, but enough for debugging
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 100) {
    Serial.print("Pitch: ");
    Serial.print(final_pitch);
    Serial.print("\tRoll: ");
    Serial.println(final_roll);
    lastPrint = millis();
  }

  // Threshold check: trigger motor if tilted more than 40 degrees
  if (abs(final_roll) > 40 || abs(final_pitch) > 40) {
    digitalWrite(MOTOR_PIN, HIGH);
  } else {
    digitalWrite(MOTOR_PIN, LOW);
  }

  // Small delay to prevent watchdog resets if loop is too tight, though handleClient helps
  delay(2); 
}