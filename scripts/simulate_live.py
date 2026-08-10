#!/usr/bin/env python3
"""Simulasi live ESP32 dengan data realistis + skenario kondisi (event).

Data dikirim ke /api/sensor persis seperti ESP32 asli (source="esp32"),
sehingga tampil seperti data nyata dan notifikasi WhatsApp terpicu otomatis
oleh logika notifier backend (perubahan state relay / kondisi ekstrem) dengan
cooldown aslinya.

Skenario event (tiap --event-min s.d. --event-max menit, acak):
  heat     -> suhu naik 34-39°C      => Kipas ON      -> notif "Kipas dinyalakan"
  dry      -> kelembaban turun 55-58% => Humidifier ON -> notif "Humidifier dinyalakan"
  extreme  -> suhu 40-42°C / hum 45-48% => Buzzer ON   -> notif "Kondisi ekstrim"

Relay di-reset ke OFF setelah event selesai agar event berikutnya selalu memicu
notifikasi lagi (hysteresis ESP32 membuat relay bisa tetap ON di suhu normal).

Contoh pemakaian:
  python scripts/simulate_live.py \
      --url https://asagri-production.up.railway.app --token <API_TOKEN>

  # hanya 120 kiriman lalu berhenti (demo singkat)
  python scripts/simulate_live.py --url <URL> --token <TOKEN> --steps 120
"""
import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request

# Ambang sama dengan esp32/main.ino
TH_FAN_ON = 32.0
TH_FAN_OFF = 25.0
TH_HUM_ON = 61.0
TH_HUM_OFF = 83.0
TH_EXT_TEMP = 40.0
TH_EXT_HUM = 50.0

BASELINE_TEMP = 28.0
BASELINE_HUM = 73.0

NORMAL_TEMP_RANGE = (26.0, 31.5)  # selalu < 32 agar Kipas OFF di periode normal
NORMAL_HUM_RANGE = (63.0, 80.0)   # selalu > 61 agar Humidifier OFF di periode normal

EVENT_WEIGHTS = {"heat": 0.40, "dry": 0.40, "extreme": 0.20}
RAMP_MINUTES = (3.0, 5.0)
HOLD_MINUTES = (2.0, 4.0)
DECAY_MINUTES = (2.0, 4.0)


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
    except urllib.error.URLError as err:
        print("URL error:", err.reason)
        return 0


class Simulator:
    def __init__(self, args: argparse.Namespace) -> None:
        self.url = args.url
        self.token = args.token
        self.interval = args.interval
        self.event_min = args.event_min
        self.event_max = args.event_max
        self.rng = random.Random(args.seed)

        self.temp = BASELINE_TEMP
        self.hum = BASELINE_HUM
        self.fan = False
        self.humid = False
        self.tick = 0
        self.event: dict | None = None
        self.next_event_tick = self._next_event_tick()

    # --- penjadwalan & event ---
    def _next_event_tick(self) -> int:
        minutes = self.rng.uniform(self.event_min, self.event_max)
        return self.tick + int(minutes * 60 / self.interval)

    def _start_event(self) -> None:
        roll = self.rng.random()
        acc = 0.0
        etype = "heat"
        for kind, weight in EVENT_WEIGHTS.items():
            acc += weight
            if roll < acc:
                etype = kind
                break

        def ticks(minutes: tuple) -> int:
            return max(1, int(self.rng.uniform(*minutes) * 60 / self.interval))

        self.event = {
            "type": etype,
            "start_tick": self.tick,
            "start_temp": self.temp,
            "start_hum": self.hum,
            "ramp": ticks(RAMP_MINUTES),
            "hold": ticks(HOLD_MINUTES),
            "decay": ticks(DECAY_MINUTES),
        }
        if etype == "heat":
            self.event["target_temp"] = self.rng.uniform(34.0, 39.0)
            self.event["target_hum"] = self.rng.uniform(62.0, 70.0)
        elif etype == "dry":
            self.event["target_temp"] = self.rng.uniform(27.0, 31.0)
            self.event["target_hum"] = self.rng.uniform(55.0, 58.0)
        else:  # extreme
            if self.rng.random() < 0.5:
                self.event["target_temp"] = self.rng.uniform(40.5, 42.0)
                self.event["target_hum"] = self.rng.uniform(62.0, 70.0)
            else:
                self.event["target_temp"] = self.rng.uniform(27.0, 31.0)
                self.event["target_hum"] = self.rng.uniform(45.0, 48.0)

    def _lerp(self, start: float, end: float, t: float) -> float:
        return start + (end - start) * max(0.0, min(1.0, t))

    def _update(self) -> None:
        if self.event is not None:
            elapsed = self.tick - self.event["start_tick"]
            total = self.event["ramp"] + self.event["hold"] + self.event["decay"]
            if elapsed >= total:
                self.event = None
                self.temp = BASELINE_TEMP
                self.hum = BASELINE_HUM
                self.fan = False
                self.humid = False
                self.next_event_tick = self._next_event_tick()
            else:
                ramp, hold = self.event["ramp"], self.event["hold"]
                t_start, t_end = self.event["start_temp"], self.event["target_temp"]
                h_start, h_end = self.event["start_hum"], self.event["target_hum"]
                if elapsed < ramp:
                    p = elapsed / ramp
                    self.temp = self._lerp(t_start, t_end, p)
                    self.hum = self._lerp(h_start, h_end, p)
                elif elapsed < ramp + hold:
                    self.temp = t_end
                    self.hum = h_end
                else:
                    p = (elapsed - ramp - hold) / max(1, self.event["decay"])
                    self.temp = self._lerp(t_end, BASELINE_TEMP, p)
                    self.hum = self._lerp(h_end, BASELINE_HUM, p)
        else:
            self.temp += self.rng.gauss(0, 0.15)
            self.temp += (BASELINE_TEMP - self.temp) * 0.02
            self.temp = max(
                NORMAL_TEMP_RANGE[0], min(NORMAL_TEMP_RANGE[1], self.temp)
            )
            self.hum += self.rng.gauss(0, 0.3)
            self.hum += (BASELINE_HUM - self.hum) * 0.03
            self.hum = max(NORMAL_HUM_RANGE[0], min(NORMAL_HUM_RANGE[1], self.hum))

            if self.tick >= self.next_event_tick:
                self._start_event()

    # --- logika relay persis ESP32 (hysteresis) ---
    def _apply_relay_logic(self) -> None:
        if self.temp >= TH_FAN_ON:
            self.fan = True
        elif self.temp <= TH_FAN_OFF:
            self.fan = False

        if self.hum <= TH_HUM_ON:
            self.humid = True
        elif self.hum >= TH_HUM_OFF:
            self.humid = False

    def _buzzer(self) -> bool:
        return self.temp > TH_EXT_TEMP or self.hum < TH_EXT_HUM

    def _event_label(self) -> str:
        if self.event is None:
            remain = max(0.0, (self.next_event_tick - self.tick) * self.interval / 60)
            return f"event berikutnya dalam ~{remain:.1f} mnt"
        elapsed = self.tick - self.event["start_tick"]
        ramp = self.event["ramp"]
        if elapsed < ramp:
            phase = "ramp"
        elif elapsed < ramp + self.event["hold"]:
            phase = "hold"
        else:
            phase = "decay"
        return f"EVENT: {self.event['type']} ({phase})"

    def run(self, steps: int | None) -> None:
        print(
            f"Simulasi live dimulai (interval {self.interval:.0f}s, "
            f"event tiap {self.event_min:.0f}-{self.event_max:.0f} mnt). "
            "Ctrl+C untuk berhenti."
        )
        count = 0
        try:
            while steps is None or count < steps:
                self._update()
                self._apply_relay_logic()
                buzzer = self._buzzer()
                payload = {
                    "temperature": round(self.temp, 1),
                    "humidity": round(self.hum, 1),
                    "relay_fan": self.fan,
                    "relay_humidifier": self.humid,
                    "relay_3": False,
                    "relay_4": False,
                    "buzzer": buzzer,
                }
                code = send(self.url, self.token, payload)
                print(
                    f"[{time.strftime('%H:%M:%S')}] t={self.temp:.1f} "
                    f"h={self.hum:.1f} fan={self.fan} humid={self.humid} "
                    f"buzzer={buzzer} | {self._event_label()} -> HTTP {code}",
                    flush=True,
                )
                count += 1
                self.tick += 1
                time.sleep(self.interval)
        except KeyboardInterrupt:
            print("\nDihentikan oleh pengguna.")
            sys.exit(0)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Simulasi live ESP32: data realistis + event kondisi (heat/dry/extreme)"
    )
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--token", default="ganti-token-esp32")
    parser.add_argument("--interval", type=float, default=10.0,
                        help="jeda kirim data dalam detik (default: 10, seperti ESP32)")
    parser.add_argument("--event-min", type=float, default=10.0,
                        help="jeda minimum antar event dalam menit (default: 10)")
    parser.add_argument("--event-max", type=float, default=20.0,
                        help="jeda maksimum antar event dalam menit (default: 20)")
    parser.add_argument("--seed", type=int, default=None,
                        help="seed acak agar hasil reproducible")
    parser.add_argument("--steps", type=int, default=None,
                        help="jumlah kiriman sebelum berhenti (default: tanpa batas)")
    args = parser.parse_args()

    if args.event_min > args.event_max:
        parser.error("--event-min tidak boleh lebih besar dari --event-max")
    if args.interval <= 0:
        parser.error("--interval harus lebih besar dari 0")

    Simulator(args).run(args.steps)


if __name__ == "__main__":
    main()
