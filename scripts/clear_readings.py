#!/usr/bin/env python3
"""Hapus semua data dari tabel sensor_readings.

Tabel lain (users, app_settings, dll) TIDAK terpengaruh.

Contoh pemakaian:
  python scripts/clear_readings.py
  python scripts/clear_readings.py --confirm
"""
import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from database import SessionLocal
from models import SensorReading


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Hapus semua data dari tabel sensor_readings"
    )
    parser.add_argument("--confirm", action="store_true",
                        help="skip prompt konfirmasi")
    args = parser.parse_args()

    session = SessionLocal()
    try:
        count = session.query(SensorReading).count()
        print(f"Tabel sensor_readings memiliki {count} baris.")

        if count == 0:
            print("Tabel sudah kosong, tidak ada yang perlu dihapus.")
            return

        if not args.confirm:
            resp = input(f"\nHapus SEMUA {count} baris dari sensor_readings? (y/n): ").strip().lower()
            if resp != "y":
                print("Dibatalkan.")
                return

        print("Menghapus data...")
        start = time.time()
        deleted = session.query(SensorReading).delete()
        session.commit()
        elapsed = time.time() - start
        print(f"Selesai! {deleted} baris dihapus dalam {elapsed:.1f}s.")
    except Exception as e:
        session.rollback()
        print(f"\nError: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
