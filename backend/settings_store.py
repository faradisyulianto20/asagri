from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from models import AppSetting

DEFAULTS: dict[str, str] = {
    "whatsapp_to": settings.whatsapp_to,
    "msg_fan_on": "⚠️ Suhu {temperature}°C melebihi ambang {threshold}°C.\n"
                  "Kipas dinyalakan otomatis.",
    "msg_humid_on": "💧 Kelembaban {humidity}% di bawah ambang {threshold}%.\n"
                    "Humidifier dinyalakan otomatis.",
    "msg_extreme": "🚨 PERINGATAN kondisi ekstrim!\n"
                   "Suhu {temperature}°C, Kelembaban {humidity}%.\n"
                   "Segera periksa ruangan.",
    "cooldown_minutes": str(settings.cooldown_minutes),
}

EDITABLE_KEYS = {
    "whatsapp_to",
    "msg_fan_on",
    "msg_humid_on",
    "msg_extreme",
    "cooldown_minutes",
}


def seed_settings(db: Session) -> None:
    for key, value in DEFAULTS.items():
        exists = db.scalar(select(AppSetting).where(AppSetting.key == key))
        if exists is None:
            db.add(AppSetting(key=key, value=value))
    db.commit()


def get_setting(db: Session, key: str) -> str:
    row = db.scalar(select(AppSetting).where(AppSetting.key == key))
    if row is None:
        return DEFAULTS.get(key, "")
    return row.value


def get_settings(db: Session) -> dict[str, str]:
    rows = db.scalars(select(AppSetting)).all()
    data = dict(DEFAULTS)
    for row in rows:
        data[row.key] = row.value
    return data


def update_settings(db: Session, data: dict) -> dict[str, str]:
    for key, value in data.items():
        if key not in EDITABLE_KEYS or value is None:
            continue
        row = db.scalar(select(AppSetting).where(AppSetting.key == key))
        if row is None:
            db.add(AppSetting(key=key, value=str(value)))
        else:
            row.value = str(value)
    db.commit()
    return get_settings(db)


def recipients(db: Session) -> list[str]:
    raw = get_setting(db, "whatsapp_to")
    return [part.strip() for part in raw.split(",") if part.strip()]


def cooldown_seconds(db: Session) -> float:
    try:
        return max(0, float(get_setting(db, "cooldown_minutes"))) * 60
    except ValueError:
        return float(settings.cooldown_minutes) * 60


def thresholds() -> dict:
    return {
        "fan_on": settings.threshold_fan_on,
        "fan_off": settings.threshold_fan_off,
        "humid_on": settings.threshold_humid_on,
        "humid_off": settings.threshold_humid_off,
        "extreme_temp": settings.extreme_temp,
        "extreme_humidity": settings.extreme_humidity,
    }
