from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import SensorReading, WaSession
from notifier import notifier

router = APIRouter()


def _check_token(x_api_token: str | None = Header(default=None)) -> None:
    if x_api_token != settings.api_token:
        raise HTTPException(status_code=401, detail="Token tidak valid")


class SensorPayload(BaseModel):
    temperature: float = Field(..., ge=-50, le=150)
    humidity: float = Field(..., ge=0, le=100)
    relay_fan: bool = False
    relay_humidifier: bool = False
    relay_3: bool = False
    relay_4: bool = False
    buzzer: bool = False
    sensor_error: bool = False


@router.post("/api/sensor", dependencies=[Depends(_check_token)])
def receive_sensor(payload: SensorPayload, db: Session = Depends(get_db)) -> dict:
    reading = SensorReading(**payload.model_dump())
    db.add(reading)
    db.commit()
    db.refresh(reading)
    notifier.handle(reading)
    return {"status": "ok", "id": reading.id}


@router.get("/api/latest")
def latest(db: Session = Depends(get_db)) -> dict:
    row = db.scalar(select(SensorReading).order_by(desc(SensorReading.id)).limit(1))
    if row is None:
        return {"available": False}
    return {
        "available": True,
        "temperature": row.temperature,
        "humidity": row.humidity,
        "relay_fan": row.relay_fan,
        "relay_humidifier": row.relay_humidifier,
        "relay_3": row.relay_3,
        "relay_4": row.relay_4,
        "buzzer": row.buzzer,
        "sensor_error": row.sensor_error,
        "created_at": row.created_at.isoformat(),
    }


@router.get("/api/history")
def history(
    hours: int = 24, db: Session = Depends(get_db)
) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = db.scalars(
        select(SensorReading)
        .where(SensorReading.created_at >= since)
        .order_by(SensorReading.created_at.asc())
    ).all()
    return [
        {
            "time": r.created_at.isoformat(),
            "temperature": r.temperature,
            "humidity": r.humidity,
            "relay_fan": r.relay_fan,
            "relay_humidifier": r.relay_humidifier,
        }
        for r in rows
    ]


@router.get("/api/wa/status")
def wa_status() -> dict:
    try:
        resp = httpx.get(
            f"{settings.wa_gateway_url.rstrip('/')}/status", timeout=10
        )
        return resp.json()
    except httpx.HTTPError as exc:
        return {"connected": False, "error": f"gateway tidak terjangkau: {exc}"}


@router.post("/api/wa/session", dependencies=[Depends(_check_token)])
def save_wa_session(payload: dict, db: Session = Depends(get_db)) -> dict:
    data = payload.get("data")
    if not data:
        raise HTTPException(status_code=400, detail="data session kosong")
    row = db.scalar(select(WaSession).where(WaSession.name == "default"))
    if row is None:
        row = WaSession(name="default", data=data.encode("utf-8"))
        db.add(row)
    else:
        row.data = data.encode("utf-8")
    db.commit()
    return {"status": "ok"}


@router.get("/api/wa/session", dependencies=[Depends(_check_token)])
def load_wa_session(db: Session = Depends(get_db)) -> dict:
    row = db.scalar(select(WaSession).where(WaSession.name == "default"))
    if row is None:
        return {"available": False}
    return {"available": True, "data": row.data.decode("utf-8")}


def _frontend_dist() -> Path:
    candidates = [
        Path("static/dist"),
        Path(__file__).parent / "static" / "dist",
        Path(__file__).parent.parent / "frontend" / "dist",
    ]
    for p in candidates:
        if (p / "index.html").is_file():
            return p
    return candidates[0]


@router.get("/dashboard")
def dashboard() -> FileResponse:
    index = _frontend_dist() / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(
        status_code=404,
        detail="Frontend belum di-build. Jalankan: cd frontend && npm run build",
    )


def create_app() -> FastAPI:
    from database import Base, engine

    Base.metadata.create_all(bind=engine)

    app = FastAPI(title="Asagri IoT Monitor")
    app.include_router(router)

    dist = _frontend_dist()
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=str(dist), html=True), name="static")
    else:
        print("[backend] frontend dist tidak ditemukan, hanya mode API")

    return app
