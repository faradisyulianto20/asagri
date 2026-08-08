import time

import httpx

from config import settings
from models import SensorReading


class Notifier:
    def __init__(self) -> None:
        self.last_state: dict[str, bool] = {}
        self.last_sent: dict[str, float] = {}
        self.baseline_seen = False

    def _notify(self, kind: str, message: str) -> None:
        now = time.time()
        cooldown = settings.cooldown_minutes * 60
        if now - self.last_sent.get(kind, 0) < cooldown:
            return
        self.last_sent[kind] = now
        try:
            httpx.post(
                f"{settings.wa_gateway_url.rstrip('/')}/send",
                json={
                    "to": settings.whatsapp_to,
                    "message": message,
                },
                headers={"Authorization": f"Bearer {settings.wa_auth_token}"},
                timeout=30,
            )
        except httpx.HTTPError as exc:
            print(f"[notifier] gagal kirim WhatsApp ({kind}): {exc}")

    def _crossed(self, state: bool, prev: bool) -> bool:
        return bool(state) and not prev

    def handle(self, reading: SensorReading) -> None:
        if not self.baseline_seen:
            self.baseline_seen = True
            self.last_state = {
                "fan": reading.relay_fan,
                "humidifier": reading.relay_humidifier,
            }
            return

        prev = self.last_state.get("fan", False)
        if self._crossed(reading.relay_fan, prev):
            self._notify(
                "fan_on",
                f"⚠️ Suhu {reading.temperature:.1f}°C melebihi ambang "
                f"{settings.threshold_fan_on:.0f}°C.\nKipas dinyalakan otomatis.",
            )
        self.last_state["fan"] = reading.relay_fan

        prev = self.last_state.get("humidifier", False)
        if self._crossed(reading.relay_humidifier, prev):
            self._notify(
                "humid_on",
                f"💧 Kelembaban {reading.humidity:.1f}% di bawah ambang "
                f"{settings.threshold_humid_on:.0f}%.\nHumidifier dinyalakan otomatis.",
            )
        self.last_state["humidifier"] = reading.relay_humidifier

        if (
            reading.temperature > settings.extreme_temp
            or reading.humidity < settings.extreme_humidity
        ):
            self._notify(
                "extreme",
                f"🚨 PERINGATAN kondisi ekstrim!\n"
                f"Suhu {reading.temperature:.1f}°C, Kelembaban {reading.humidity:.1f}%.\n"
                f"Segera periksa ruangan.",
            )


notifier = Notifier()
