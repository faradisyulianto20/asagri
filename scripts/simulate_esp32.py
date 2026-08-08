#!/usr/bin/env python3
"""Simulasi ESP32: mengirim data palsu ke backend untuk pengujian tanpa hardware.

Contoh pemakaian:
  python scripts/simulate_esp32.py --url http://localhost:8000 --token <API_TOKEN>
"""
import argparse
import json
import time
import urllib.request


def send(url: str, token: str, payload: dict) -> int:
    req = urllib.request.Request(
        url + "/api/sensor",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "X-API-Token": token,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status
    except urllib.error.HTTPError as err:
        print("HTTP error:", err.code, err.read().decode())
        return err.code


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulasi data ESP32 (SHT31 + relay)")
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--token", default="ganti-token-esp32")
    parser.add_argument("--interval", type=float, default=5.0)
    args = parser.parse_args()

    temp, hum, fan, humid = 28.0, 70.0, False, False
    print("Simulasi ESP32 berjalan. Ctrl+C untuk berhenti.")
    while True:
        payload = {
            "temperature": round(temp, 1),
            "humidity": round(hum, 1),
            "relay_fan": fan,
            "relay_humidifier": humid,
            "relay_3": False,
            "relay_4": False,
            "buzzer": temp > 40.0 or hum < 50.0,
        }
        code = send(args.url, args.token, payload)
        print(f"[{time.strftime('%H:%M:%S')}] t={temp:.1f} h={hum:.1f} "
              f"fan={fan} humid={humid} -> HTTP {code}")

        temp += 1.0
        if temp > 34.0:
            fan = True
        if temp >= 41.0:
            temp, fan = 28.0, False
        hum -= 2.0
        if hum < 58.0:
            humid = True
        if hum <= 50.0:
            hum, humid = 70.0, False

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
