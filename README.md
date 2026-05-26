<div align="center">

# 🧠 SpineUp — Ultimate Smart Posture Tracker

### _Real-time IoT posture monitoring with ESP32, MPU6050 & a modern React dashboard_

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![ESP32](https://img.shields.io/badge/ESP32-Arduino-E7352C?style=for-the-badge&logo=arduino&logoColor=white)](https://www.espressif.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-FF0055?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)

<br/>

<img src="./screenshots/dashboard.png" alt="SpineUp Dashboard — Real-Time Posture Tracking" width="85%"/>

<br/>

**SpineUp** is a full-stack IoT posture monitoring system that pairs an **ESP32 microcontroller** with an **MPU6050 accelerometer/gyroscope** to measure spinal tilt angle in real time — then streams the data over **Wi-Fi** to a modern **React dashboard** featuring Apple-inspired activity rings, live telemetry graphs, calendar history, multiple themes, and haptic vibration feedback when poor posture is detected.

<br/>

[✨ Features](#-features) · [📸 Screenshots](#-screenshots) · [🚀 Quick Start](#-quick-start) · [🔌 Hardware Setup](#-hardware-setup) · [⚙️ Configuration](#%EF%B8%8F-configuration) · [🏗️ Architecture](#%EF%B8%8F-architecture) · [📜 License](#-license)

</div>

---

# ✨ Features

<table>
<tr>
<td width="50%">

## 🎯 Real-Time Posture Monitoring

- **Apple Watch-style activity ring** — animated SVG ring fills dynamically based on posture angle
- **Complementary filter fusion** — combines accelerometer + gyroscope data for stable and responsive tracking
- **Live telemetry graph** — smooth scrolling posture visualization updated every 200ms
- **Instant posture classification** — Excellent / Good / Fair / Poor posture detection with color feedback

</td>

<td width="50%">

## 📊 Analytics & History

- **Session scoring** — cumulative posture score generated from live tracking
- **Streak tracker** — counts consecutive seconds of good posture
- **Calendar heatmap** — monthly history visualization with score rings
- **Weekly trend chart** — bar-chart overview of posture consistency
- **Monthly statistics** — average score, tracked hours, and improvement trends

</td>
</tr>

<tr>
<td>

## 🎨 Premium Design System

- **4 built-in themes** — Base, Light, Gamer, and Student themes
- **Glassmorphic UI panels** — frosted-glass cards with subtle transparency
- **Smooth animations** — powered by Framer Motion spring physics
- **Responsive layout** — desktop sidebar + mobile navigation
- **Persistent settings** — preferences saved using localStorage

</td>

<td>

## 🔧 Hardware & Connectivity

- **ESP32 Access Point mode** — creates its own Wi-Fi network
- **RESTful `/angle` endpoint** — lightweight JSON API with CORS support
- **Vibration motor feedback** — haptic alerts when posture exceeds threshold
- **Startup auto-calibration** — 500-sample sensor calibration
- **Configurable sensitivity** — adjustable thresholds and smoothing from the dashboard

</td>
</tr>
</table>

---

# 📸 Screenshots

<div align="center">

## 🖥️ Dashboard — Live Tracking

<img src="./screenshots/dashboard.png" alt="SpineUp Dashboard" width="90%"/>

> The main dashboard includes an Apple-inspired activity ring, live posture graph, streak counter, session score, and elapsed timer in a glassmorphic dark interface.

---

## 📅 History — Calendar View

<img src="./screenshots/history.png" alt="SpineUp History" width="90%"/>

> Browse posture history month by month using calendar-based score visualization and weekly trend tracking.

---

## ⚙️ Settings — Full Customization

<img src="./screenshots/settings.png" alt="SpineUp Settings" width="90%"/>

> Configure ESP32 connection settings, choose themes, and adjust posture sensitivity thresholds.

---

## 🔌 Hardware Diagram

<img src="./screenshots/hardware_diagram.png" alt="Hardware Wiring Diagram" width="80%"/>

> Simple I2C connection between the ESP32 and MPU6050 with a vibration motor connected to GPIO 23.

</div>

---

# 🚀 Quick Start

## Prerequisites

| Tool | Version | Purpose |
|:--|:--|:--|
| Node.js | 18+ | React development server |
| npm | 9+ | Package management |
| Arduino IDE | 2.x | ESP32 firmware upload |
| ESP32 Board | Any variant | Microcontroller |
| MPU6050 | GY-521 module | IMU sensor |

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/maryam305/SpineUp.git
cd SpineUp
