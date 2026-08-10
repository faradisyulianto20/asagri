import time
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from config import settings
from models import SensorReading
from settings_store import cooldown_seconds, get_setting, recipients


def _gateway_detail(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        for key in ("detail", "error", "message"):
            if body.get(key):
                return str(body[key])[:300]
    return (resp.text or "").strip()[:300]


def _delivery(ok: bool, error: str | None, to: list[str]) -> dict:
    return {
        "ok": ok,
        "error": error,
        "to": to,
        "at": datetime.now(timezone.utc).isoformat(),
    }


class Notifier:
    def __init__(self) -> None:
        self.last_state: dict[str, bool] = {}
        self.last_sent: dict[str, float] = {}
        self.baseline_seen = False
        self.pending: set[str] = set()
        self.last_delivery: dict | None = None

    def _post_with_retry(
        self, to: list[str], message: str, *, retries: int = 5, backoff: tuple = (0, 1, 3, 8, 15)
    ) -> dict:
        """Kirim pesan, dengan retry backoff untuk menutup jendela restart gateway."""
        url = f"{settings.wa_gateway_url.rstrip('/')}/send"
        headers = {"Authorization": f"Bearer {settings.wa_auth_token}"}
        for attempt in range(retries):
            if attempt:
                time.sleep(backoff[min(attempt, len(backoff) - 1)])
            try:
                resp = httpx.post(
                    url,
                    json={"to": to, "message": message},
                    headers=headers,
                    timeout=40,
                )
                if resp.status_code in (500, 502, 503, 504) and attempt < retries - 1:
                    continue
                if resp.status_code < 400:
                    return _delivery(True, None, to)
                return _delivery(
                    False,
                    f"gateway HTTP {resp.status_code}: {_gateway_detail(resp)}",
                    to,
                )
            except httpx.HTTPError as exc:
                if attempt < retries - 1:
                    continue
                return _delivery(False, f"gateway tidak terjangkau: {exc}", to)
        return _delivery(False, "gateway tidak merespons", to)

    def _post(self, message: str, db: Session) -> bool:
        to = recipients(db)
        if not to:
            self.last_delivery = {
                "ok": False,
                "error": "Tidak ada nomor penerima. Isi daftar di menu Pengaturan.",
                "to": [],
                "at": datetime.now(timezone.utc).isoformat(),
            }
            return False
        self.last_delivery = self._post_with_retry(to, message)
        return self.last_delivery["ok"]

    def _notify(self, kind: str, message: str, db: Session) -> bool:
        now = time.time()
        if now - self.last_sent.get(kind, 0) < cooldown_seconds(db):
            return False
        if self._post(message, db):
            self.last_sent[kind] = now
            return True
        return False

    def _crossed(self, state: bool, prev: bool) -> bool:
        return bool(state) and not prev

    def _track_state(self, reading: SensorReading) -> None:
        """Perbarui baseline & last_state tanpa memicu notifikasi."""
        if not self.baseline_seen:
            self.baseline_seen = True
            self.last_state = {
                "fan": reading.relay_fan,
                "humidifier": reading.relay_humidifier,
            }
            return
        self.last_state["fan"] = reading.relay_fan
        self.last_state["humidifier"] = reading.relay_humidifier

    def handle(self, reading: SensorReading, db: Session) -> None:
        if not self.baseline_seen:
            self._track_state(reading)
            return

        fan_crossed = self._crossed(
            reading.relay_fan, self.last_state.get("fan", False)
        )
        humid_crossed = self._crossed(
            reading.relay_humidifier, self.last_state.get("humidifier", False)
        )
        self._track_state(reading)

        if fan_crossed:
            self.pending.add("fan_on")
        if humid_crossed:
            self.pending.add("humid_on")

        if "fan_on" in self.pending and reading.relay_fan:
            template = get_setting(db, "msg_fan_on")
            message = template.format(
                temperature=f"{reading.temperature:.1f}",
                threshold=f"{settings.threshold_fan_on:.0f}",
            )
            if self._notify("fan_on", message, db):
                self.pending.discard("fan_on")

        if "humid_on" in self.pending and reading.relay_humidifier:
            template = get_setting(db, "msg_humid_on")
            message = template.format(
                humidity=f"{reading.humidity:.1f}",
                threshold=f"{settings.threshold_humid_on:.0f}",
            )
            if self._notify("humid_on", message, db):
                self.pending.discard("humid_on")

        if (
            reading.temperature > settings.extreme_temp
            or reading.humidity < settings.extreme_humidity
        ):
            template = get_setting(db, "msg_extreme")
            message = template.format(
                temperature=f"{reading.temperature:.1f}",
                humidity=f"{reading.humidity:.1f}",
            )
            self._notify("extreme", message, db)

    def _fan_reason(self, reading: SensorReading) -> str:
        if reading.relay_fan:
            return f"suhu {reading.temperature:.1f}°C ≥ {settings.threshold_fan_on:.1f}°C"
        if reading.temperature <= settings.threshold_fan_off:
            return f"suhu {reading.temperature:.1f}°C ≤ {settings.threshold_fan_off:.1f}°C"
        return "suhu normal"

    def _humidifier_reason(self, reading: SensorReading) -> str:
        if reading.relay_humidifier:
            return (
                f"kelembaban {reading.humidity:.1f}% ≤ "
                f"{settings.threshold_humid_on:.1f}%"
            )
        if reading.humidity >= settings.threshold_humid_off:
            return (
                f"kelembaban {reading.humidity:.1f}% ≥ "
                f"{settings.threshold_humid_off:.1f}%"
            )
        return "kelembaban normal"

    def _buzzer_reason(self, reading: SensorReading) -> str:
        if not reading.buzzer:
            return "normal"
        reasons = []
        if reading.temperature > settings.extreme_temp:
            reasons.append(
                f"suhu {reading.temperature:.1f}°C > {settings.extreme_temp:.1f}°C"
            )
        if reading.humidity < settings.extreme_humidity:
            reasons.append(
                f"kelembaban {reading.humidity:.1f}% < "
                f"{settings.extreme_humidity:.1f}%"
            )
        return " atau ".join(reasons)

    def send_simulation(self, reading: SensorReading, db: Session) -> dict:
        """Kirim pesan uji langsung untuk data simulasi (tanpa cooldown)."""
        self._track_state(reading)
        message = (
            "🧪 Pesan Uji Simulasi — Asagri Monitor\n"
            f"Suhu: {reading.temperature:.1f}°C | Kelembaban: {reading.humidity:.1f}%\n\n"
            f"Kipas: {'ON' if reading.relay_fan else 'OFF'} ({self._fan_reason(reading)})\n"
            f"Humidifier: {'ON' if reading.relay_humidifier else 'OFF'} ({self._humidifier_reason(reading)})\n"
            f"Buzzer: {'ON' if reading.buzzer else 'OFF'} ({self._buzzer_reason(reading)})"
        )
        self._post(message, db)
        result = dict(self.last_delivery or {})
        result["kind"] = "simulasi"
        return result

    def send_test(self, db: Session) -> dict:
        message = (
            "✅ Pesan uji dari Asagri Monitor.\n"
            "Jika Anda menerima ini, notifikasi WhatsApp berfungsi."
        )
        self._post(message, db)
        result = dict(self.last_delivery or {})
        result["kind"] = "test"
        return result

    def send_to(self, number: str, message: str) -> bool:
        to = [number]
        self.last_delivery = self._post_with_retry(to, message)
        return self.last_delivery["ok"]


notifier = Notifier()
