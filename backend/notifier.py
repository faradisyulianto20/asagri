import time
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from config import settings
from models import SensorReading
from settings_store import cooldown_seconds, get_setting, recipients


class Notifier:
    def __init__(self) -> None:
        self.last_state: dict[str, bool] = {}
        self.last_sent: dict[str, float] = {}
        self.baseline_seen = False
        self.pending: set[str] = set()
        self.last_delivery: dict | None = None

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
        try:
            resp = httpx.post(
                f"{settings.wa_gateway_url.rstrip('/')}/send",
                json={"to": to, "message": message},
                headers={"Authorization": f"Bearer {settings.wa_auth_token}"},
                timeout=30,
            )
            ok = resp.status_code < 400
            self.last_delivery = {
                "ok": ok,
                "error": None if ok else f"gateway HTTP {resp.status_code}: {resp.text[:200]}",
                "to": to,
                "at": datetime.now(timezone.utc).isoformat(),
            }
            return ok
        except httpx.HTTPError as exc:
            self.last_delivery = {
                "ok": False,
                "error": f"gateway tidak terjangkau: {exc}",
                "to": to,
                "at": datetime.now(timezone.utc).isoformat(),
            }
            return False

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

    def handle(self, reading: SensorReading, db: Session) -> None:
        if not self.baseline_seen:
            self.baseline_seen = True
            self.last_state = {
                "fan": reading.relay_fan,
                "humidifier": reading.relay_humidifier,
            }
            return

        if self._crossed(reading.relay_fan, self.last_state.get("fan", False)):
            self.pending.add("fan_on")
        self.last_state["fan"] = reading.relay_fan

        if self._crossed(
            reading.relay_humidifier, self.last_state.get("humidifier", False)
        ):
            self.pending.add("humid_on")
        self.last_state["humidifier"] = reading.relay_humidifier

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
        try:
            resp = httpx.post(
                f"{settings.wa_gateway_url.rstrip('/')}/send",
                json={"to": to, "message": message},
                headers={"Authorization": f"Bearer {settings.wa_auth_token}"},
                timeout=30,
            )
            ok = resp.status_code < 400
            self.last_delivery = {
                "ok": ok,
                "error": None if ok else f"gateway HTTP {resp.status_code}: {resp.text[:200]}",
                "to": to,
                "at": datetime.now(timezone.utc).isoformat(),
            }
            return ok
        except httpx.HTTPError as exc:
            self.last_delivery = {
                "ok": False,
                "error": f"gateway tidak terjangkau: {exc}",
                "to": to,
                "at": datetime.now(timezone.utc).isoformat(),
            }
            return False


notifier = Notifier()
