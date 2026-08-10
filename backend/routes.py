import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from config import settings
from database import get_db
from auth import create_session, delete_session, get_user_by_token, seed_admin, verify_password
from models import SensorReading, User, WaNumberRequest, WaSession
from notifier import notifier
from settings_store import (
    EDITABLE_KEYS,
    get_settings,
    recipients,
    seed_settings,
    thresholds,
    update_settings,
)

router = APIRouter()


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


def _check_token(x_api_token: str | None = Header(default=None)) -> None:
    if x_api_token != settings.api_token:
        raise HTTPException(status_code=401, detail="Token tidak valid")


def _check_admin(
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    user = get_user_by_token(db, x_admin_token)
    if user is None:
        raise HTTPException(
            status_code=401, detail="Sesi admin tidak valid atau kedaluwarsa"
        )
    return user


class LoginPayload(BaseModel):
    username: str
    password: str


@router.post("/api/auth/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.username == payload.username))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_session(db, user)
    return {"token": token, "username": user.username}


@router.post("/api/auth/logout", dependencies=[Depends(_check_admin)])
def logout(
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    delete_session(db, x_admin_token)
    return {"status": "ok"}


@router.get("/api/auth/me", dependencies=[Depends(_check_admin)])
def me(
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    user = get_user_by_token(db, x_admin_token)
    return {"username": user.username}


class SensorPayload(BaseModel):
    temperature: float = Field(..., ge=-50, le=150)
    humidity: float = Field(..., ge=0, le=100)
    relay_fan: bool = False
    relay_humidifier: bool = False
    relay_3: bool = False
    relay_4: bool = False
    buzzer: bool = False
    sensor_error: bool = False


class SimulatePayload(BaseModel):
    temperature: float = Field(..., ge=-10, le=70)
    humidity: float = Field(..., ge=0, le=100)


class SettingsPayload(BaseModel):
    whatsapp_to: str | None = None
    msg_fan_on: str | None = None
    msg_humid_on: str | None = None
    msg_extreme: str | None = None
    cooldown_minutes: float | None = Field(default=None, ge=0)


@router.post("/api/sensor", dependencies=[Depends(_check_token)])
def receive_sensor(payload: SensorPayload, db: Session = Depends(get_db)) -> dict:
    reading = SensorReading(**payload.model_dump())
    db.add(reading)
    db.commit()
    db.refresh(reading)
    notifier.handle(reading, db)
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
        "source": row.source,
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
            "source": r.source,
        }
        for r in rows
    ]


@router.get("/api/thresholds")
def get_thresholds() -> dict:
    return thresholds()


@router.get("/api/settings", dependencies=[Depends(_check_admin)])
def admin_settings(db: Session = Depends(get_db)) -> dict:
    data = get_settings(db)
    data["thresholds"] = thresholds()
    return data


@router.put("/api/settings", dependencies=[Depends(_check_admin)])
def update_admin_settings(
    payload: SettingsPayload, db: Session = Depends(get_db)
) -> dict:
    data = payload.model_dump(exclude_unset=True)
    unknown = set(data) - EDITABLE_KEYS
    if unknown:
        raise HTTPException(status_code=400, detail=f"Kunci tidak dikenal: {unknown}")
    updated = update_settings(db, data)
    updated["thresholds"] = thresholds()
    return updated


@router.post("/api/simulate", dependencies=[Depends(_check_admin)])
def simulate(payload: SimulatePayload, db: Session = Depends(get_db)) -> dict:
    t = payload.temperature
    h = payload.humidity
    latest_row = db.scalar(
        select(SensorReading).order_by(desc(SensorReading.id)).limit(1)
    )
    prev_fan = latest_row.relay_fan if latest_row else False
    prev_hum = latest_row.relay_humidifier if latest_row else False

    fan = True if t >= settings.threshold_fan_on else (
        False if t <= settings.threshold_fan_off else prev_fan
    )
    humidifier = True if h <= settings.threshold_humid_on else (
        False if h >= settings.threshold_humid_off else prev_hum
    )
    buzzer = t > settings.extreme_temp or h < settings.extreme_humidity

    reading = SensorReading(
        temperature=t,
        humidity=h,
        relay_fan=fan,
        relay_humidifier=humidifier,
        relay_3=False,
        relay_4=False,
        buzzer=buzzer,
        sensor_error=False,
        source="simulasi",
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    notification = notifier.send_simulation(reading, db)

    return {
        "id": reading.id,
        "temperature": t,
        "humidity": h,
        "relay_fan": fan,
        "relay_humidifier": humidifier,
        "buzzer": buzzer,
        "source": reading.source,
        "created_at": reading.created_at.isoformat(),
        "notification": notification,
    }


@router.get("/api/notify/status")
def notify_status() -> dict:
    return {
        "available": notifier.last_delivery is not None,
        "last": notifier.last_delivery,
    }


def _gateway_url(path: str) -> str:
    return f"{settings.wa_gateway_url.rstrip('/')}{path}"


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


def _gateway_request(
    method: str,
    path: str,
    *,
    timeout: float = 30,
    retries: int = 2,
) -> httpx.Response:
    """Hubungi wa-gateway dengan retry singkat untuk error transien (cold-start).

    Mengangkat HTTPException(503) saat gateway tidak terjangkau/tidak merespons.
    """
    url = _gateway_url(path)
    headers = {"Authorization": f"Bearer {settings.wa_auth_token}"}
    last_resp: httpx.Response | None = None
    for attempt in range(retries):
        if attempt:
            time.sleep(1)
        try:
            resp = httpx.request(method, url, headers=headers, timeout=timeout)
        except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError) as exc:
            if attempt < retries - 1:
                continue
            raise HTTPException(
                status_code=503,
                detail="Gateway WhatsApp tidak merespons (mungkin sedang tidur atau menyalakan ulang): "
                f"{exc}",
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=503, detail=f"Gateway WhatsApp tidak terjangkau: {exc}"
            )
        if resp.status_code in (502, 503, 504) and attempt < retries - 1:
            last_resp = resp
            continue
        return resp
    if last_resp is not None:
        return last_resp
    raise HTTPException(
        status_code=503, detail="Gateway WhatsApp tidak merespons (mungkin sedang tidur)"
    )


def _gateway_http_error(resp: httpx.Response) -> HTTPException:
    detail = _gateway_detail(resp)
    if resp.status_code == 401:
        message = (
            "Token gateway WhatsApp tidak cocok. Periksa WA_AUTH_TOKEN "
            "(backend) vs AUTH_TOKEN (wa-gateway)."
        )
        if detail:
            message += f" {detail}"
        return HTTPException(status_code=502, detail=message)
    message = f"Gateway WhatsApp menolak permintaan (HTTP {resp.status_code})."
    if detail:
        message += f" {detail}"
    return HTTPException(status_code=502, detail=message)


@router.get("/api/wa/status")
def wa_status() -> dict:
    try:
        resp = _gateway_request("GET", "/status", timeout=10, retries=2)
    except HTTPException as exc:
        return {"connected": False, "error": str(exc.detail)}
    if resp.status_code >= 400:
        return {
            "connected": False,
            "error": _gateway_detail(resp) or f"gateway HTTP {resp.status_code}",
        }
    try:
        return resp.json()
    except ValueError:
        return {"connected": False, "error": "respons gateway bukan JSON"}


@router.post("/api/wa/disconnect", dependencies=[Depends(_check_admin)])
def wa_disconnect() -> dict:
    resp = _gateway_request("POST", "/disconnect", timeout=30)
    if resp.status_code >= 400:
        raise _gateway_http_error(resp)
    return resp.json()


@router.post("/api/wa/test", dependencies=[Depends(_check_admin)])
def wa_test(db: Session = Depends(get_db)) -> dict:
    result = notifier.send_test(db)
    if not result.get("ok"):
        raise HTTPException(
            status_code=502, detail=result.get("error") or "Gagal mengirim pesan uji"
        )
    return result


@router.post("/api/wa/session", dependencies=[Depends(_check_token)])
def save_wa_session(payload: dict, db: Session = Depends(get_db)) -> dict:
    data = payload.get("data")
    number = payload.get("number")
    row = db.scalar(select(WaSession).where(WaSession.name == "default"))
    if row is None:
        row = WaSession(name="default", data=(data or "").encode("utf-8"))
        if number:
            row.number = number
        db.add(row)
    else:
        if data:
            row.data = data.encode("utf-8")
        if number:
            row.number = number
    db.commit()
    return {"status": "ok"}


@router.get("/api/wa/session", dependencies=[Depends(_check_token)])
def load_wa_session(db: Session = Depends(get_db)) -> dict:
    row = db.scalar(select(WaSession).where(WaSession.name == "default"))
    if row is None:
        return {"available": False}
    return {
        "available": True,
        "data": row.data.decode("utf-8"),
        "number": row.number,
    }


@router.delete("/api/wa/session", dependencies=[Depends(_check_token)])
def delete_wa_session(db: Session = Depends(get_db)) -> dict:
    row = db.scalar(select(WaSession).where(WaSession.name == "default"))
    if row is not None:
        db.delete(row)
        db.commit()
    return {"status": "ok"}


class NumberRequestPayload(BaseModel):
    name: str
    number: str


def _normalize_number(number: str) -> str:
    cleaned = number.replace(" ", "").replace("-", "")
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    if cleaned.startswith("0"):
        cleaned = "62" + cleaned[1:]
    return cleaned


def _valid_number(number: str) -> bool:
    return number.startswith("628") and len(number) >= 10 and len(number) <= 15 and number.isdigit()


@router.post("/api/wa/request")
def submit_number_request(
    payload: NumberRequestPayload, db: Session = Depends(get_db)
) -> dict:
    name = payload.name.strip()
    number = _normalize_number(payload.number)
    if not name:
        raise HTTPException(status_code=400, detail="Nama tidak boleh kosong")
    if not _valid_number(number):
        raise HTTPException(
            status_code=400,
            detail="Nomor tidak valid. Gunakan format 628xxx tanpa + dan tanpa awalan 0.",
        )

    row = db.scalar(
        select(WaNumberRequest).where(WaNumberRequest.number == number)
    )
    if row is not None and row.status == "approved":
        return {
            "status": "approved",
            "name": row.name,
            "number": row.number,
            "message": "Nomor ini sudah terdaftar sebagai penerima notifikasi.",
        }
    if row is None:
        row = WaNumberRequest(name=name, number=number, status="pending")
        db.add(row)
    else:
        row.name = name
        row.status = "pending"
        row.decided_at = None
        row.decided_by = None
    db.commit()
    return {
        "status": "pending",
        "name": row.name,
        "number": row.number,
        "message": "Permintaan dikirim dan menunggu persetujuan admin.",
    }


@router.get("/api/wa/request/status")
def number_request_status(number: str, db: Session = Depends(get_db)) -> dict:
    normalized = _normalize_number(number)
    if not normalized:
        return {"status": "none", "number": number}
    row = db.scalar(
        select(WaNumberRequest).where(WaNumberRequest.number == normalized)
    )
    if row is None:
        return {"status": "none", "number": number}
    return {
        "status": row.status,
        "name": row.name,
        "number": row.number,
        "decided_at": row.decided_at.isoformat() if row.decided_at else None,
    }


def _request_dict(row: WaNumberRequest) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "number": row.number,
        "status": row.status,
        "created_at": row.created_at.isoformat(),
        "decided_at": row.decided_at.isoformat() if row.decided_at else None,
        "decided_by": row.decided_by,
    }


@router.get("/api/wa/requests", dependencies=[Depends(_check_admin)])
def list_number_requests(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(WaNumberRequest).order_by(desc(WaNumberRequest.created_at))
    ).all()
    return [_request_dict(r) for r in rows]


@router.post(
    "/api/wa/requests/{request_id}/approve", dependencies=[Depends(_check_admin)]
)
def approve_number_request(
    request_id: int,
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(WaNumberRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Permintaan tidak ditemukan")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Permintaan sudah diproses")
    admin = get_user_by_token(db, x_admin_token)

    current = recipients(db)
    if row.number not in current:
        current.append(row.number)
    update_settings(db, {"whatsapp_to": ", ".join(current)})

    row.status = "approved"
    row.decided_at = datetime.now(timezone.utc)
    row.decided_by = admin.username
    db.commit()

    delivery_ok = notifier.send_to(
        row.number,
        "✅ Halo "
        + row.name
        + ",\nNomor WhatsApp Anda sudah disetujui dan akan menerima notifikasi dari Asagri Monitor.",
    )
    return {**_request_dict(row), "confirmation_sent": delivery_ok}


@router.post(
    "/api/wa/requests/{request_id}/reject", dependencies=[Depends(_check_admin)]
)
def reject_number_request(
    request_id: int,
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(WaNumberRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Permintaan tidak ditemukan")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Permintaan sudah diproses")
    admin = get_user_by_token(db, x_admin_token)

    row.status = "rejected"
    row.decided_at = datetime.now(timezone.utc)
    row.decided_by = admin.username
    db.commit()
    return _request_dict(row)


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


def _migrate(engine) -> None:
    try:
        with engine.begin() as conn:
            if conn.dialect.name == "postgresql":
                conn.exec_driver_sql(
                    "ALTER TABLE sensor_readings "
                    "ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'esp32'"
                )
                conn.exec_driver_sql(
                    "ALTER TABLE wa_session "
                    "ADD COLUMN IF NOT EXISTS number VARCHAR(32)"
                )
            else:
                cols = conn.exec_driver_sql("PRAGMA table_info(sensor_readings)").fetchall()
                names = {row[1] for row in cols}
                if "source" not in names:
                    conn.exec_driver_sql(
                        "ALTER TABLE sensor_readings "
                        "ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'esp32'"
                    )
                wa_cols = conn.exec_driver_sql("PRAGMA table_info(wa_session)").fetchall()
                wa_names = {row[1] for row in wa_cols}
                if "number" not in wa_names:
                    conn.exec_driver_sql(
                        "ALTER TABLE wa_session ADD COLUMN number VARCHAR(32)"
                    )
    except Exception as exc:  # noqa: BLE001
        print(f"[backend] migrasi dilewati: {exc}")


def create_app() -> FastAPI:
    from database import Base, engine

    Base.metadata.create_all(bind=engine)
    _migrate(engine)

    from database import SessionLocal

    with SessionLocal() as db:
        seed_settings(db)
        seed_admin(db)

    app = FastAPI(title="Asagri IoT Monitor")
    app.include_router(router)

    dist = _frontend_dist()
    if dist.is_dir():
        app.mount("/", SPAStaticFiles(directory=str(dist), html=True), name="static")
    else:
        print("[backend] frontend dist tidak ditemukan, hanya mode API")

    return app
