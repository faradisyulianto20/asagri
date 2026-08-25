#!/usr/bin/env python3
"""Insert dummy data ke tabel sensor_readings.

Data di-generate dengan pola realistis mengikuti logika ESP32:
  - Suhu: 25-42°C (dengan Gaussian noise)
  - Kelembapan: 45-85%
  - Relay: hysteresis logika ESP32
  - Buzzer: aktif jika suhu > 40°C atau humidity < 50%
  - Source: "dummy"

Contoh pemakaian:
  python scripts/seed_dummy.py
  python scripts/seed_dummy.py --count 5000 --interval 30
  python scripts/seed_dummy.py --confirm
"""
import argparse
import random
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from database import SessionLocal
from models import SensorReading

TH_FAN_ON = 32.0
TH_FAN_OFF = 25.0
TH_HUM_ON = 61.0
TH_HUM_OFF = 83.0
TH_EXT_TEMP = 40.0
TH_EXT_HUM = 50.0

BASELINE_TEMP = 28.0
BASELINE_HUM = 73.0


def generate_readings(count: int, interval_sec: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    readings = []

    temp = BASELINE_TEMP
    hum = BASELINE_HUM
    fan = False
    humid = False

    for i in range(count):
        temp += rng.gauss(0, 0.15)
        temp += (BASELINE_TEMP - temp) * 0.02
        temp = max(24.0, min(43.0, temp))

        hum += rng.gauss(0, 0.3)
        hum += (BASELINE_HUM - hum) * 0.03
        hum = max(40.0, min(90.0, hum))

        if temp >= TH_FAN_ON:
            fan = True
        elif temp <= TH_FAN_OFF:
            fan = False

        if hum <= TH_HUM_ON:
            humid = True
        elif hum >= TH_HUM_OFF:
            humid = False

        buzzer = temp > TH_EXT_TEMP or hum < TH_EXT_HUM
        sensor_error = rng.random() < 0.05

        ts = now - timedelta(seconds=(count - 1 - i) * interval_sec)

        readings.append({
            "temperature": round(temp, 1),
            "humidity": round(hum, 1),
            "relay_fan": fan,
            "relay_humidifier": humid,
            "relay_3": False,
            "relay_4": False,
            "buzzer": buzzer,
            "sensor_error": sensor_error,
            "source": "dummy",
            "created_at": ts,
        })

    return readings


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Insert dummy data ke tabel sensor_readings"
    )
    parser.add_argument("--count", type=int, default=10000,
                        help="jumlah baris dummy (default: 10000)")
    parser.add_argument("--interval", type=int, default=10,
                        help="interval detik antar data (default: 10)")
    parser.add_argument("--seed", type=int, default=42,
                        help="seed acak agar reproducible (default: 42)")
    parser.add_argument("--confirm", action="store_true",
                        help="skip prompt konfirmasi")
    args = parser.parse_args()

    if args.count <= 0:
        parser.error("--count harus lebih besar dari 0")
    if args.interval <= 0:
        parser.error("--interval harus lebih besar dari 0")

    print(f"Menggenerate {args.count} data dummy (interval {args.interval}s)...")
    readings = generate_readings(args.count, args.interval, args.seed)
    print(f"  Suhu range: {min(r['temperature'] for r in readings):.1f} - "
          f"{max(r['temperature'] for r in readings):.1f}°C")
    print(f"  Hum range:  {min(r['humidity'] for r in readings):.1f} - "
          f"{max(r['humidity'] for r in readings):.1f}%")
    print(f"  Timestamp:  {readings[0]['created_at'].isoformat()} -> "
          f"{readings[-1]['created_at'].isoformat()}")

    if not args.confirm:
        resp = input(f"\nMasukkan {args.count} data ke database? (y/n): ").strip().lower()
        if resp != "y":
            print("Dibatalkan.")
            sys.exit(0)

    print("\nMenulis ke database...")
    start = time.time()
    session = SessionLocal()
    try:
        batch_size = 1000
        inserted = 0
        for i in range(0, len(readings), batch_size):
            batch = readings[i:i + batch_size]
            objs = [SensorReading(**r) for r in batch]
            session.bulk_save_objects(objs)
            session.commit()
            inserted += len(batch)
            pct = inserted / len(readings) * 100
            print(f"  [{inserted}/{len(readings)}] {pct:.0f}%", flush=True)

        elapsed = time.time() - start
        print(f"\nSelesai! {inserted} baris di-insert dalam {elapsed:.1f}s.")
    except Exception as e:
        session.rollback()
        print(f"\nError: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
