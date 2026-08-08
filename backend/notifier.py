import time

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

    def _notify(self, kind: str, message: str, db: Session) -> None:
        now = time.time()
        if now - self.last_sent.get(kind, 0) < cooldown_seconds(db):
            return
        self.last_sent[kind] = now
        to = recipients(db)
        if not to:
            print(f"[notifier] tidak ada nomor penerima ({kind})")
            return
        try:
            httpx.post(
                f"{settings.wa_gateway_url.rstrip('/')}/send",
                json={"to": to, "message": message},
                headers={"Authorization": f"Bearer {settings.wa_auth_token}"},
                timeout=30,
            )
        except httpx.HTTPError as exc:
            print(f"[notifier] gagal kirim WhatsApp ({kind}): {exc}")

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

        prev = self.last_state.get("fan", False)
        if self._crossed(reading.relay_fan, prev):
            template = get_setting(db, "msg_fan_on")
            message = template.format(
                temperature=f"{reading.temperature:.1f}",
                threshold=f"{settings.threshold_fan_on:.0f}",
            )
            self._notify("fan_on", message, db)
        self.last_state["fan"] = reading.relay_fan

        prev = self.last_state.get("humidifier", False)
        if self._crossed(reading.relay_humidifier, prev):
            template = get_setting(db, "msg_humid_on")
            message = template.format(
                humidity=f"{reading.humidity:.1f}",
                threshold=f"{settings.threshold_humid_on:.0f}",
            )
            self._notify("humid_on", message, db)
        self.last_state["humidifier"] = reading.relay_humidifier

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


notifier = Notifier()
