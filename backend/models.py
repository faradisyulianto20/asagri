from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    humidity: Mapped[float] = mapped_column(Float, nullable=False)
    relay_fan: Mapped[bool] = mapped_column(Boolean, default=False)
    relay_humidifier: Mapped[bool] = mapped_column(Boolean, default=False)
    relay_3: Mapped[bool] = mapped_column(Boolean, default=False)
    relay_4: Mapped[bool] = mapped_column(Boolean, default=False)
    buzzer: Mapped[bool] = mapped_column(Boolean, default=False)
    sensor_error: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class WaSession(Base):
    __tablename__ = "wa_session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, default="default")
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
