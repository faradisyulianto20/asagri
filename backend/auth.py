import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from models import AdminSession, User

_ITERATIONS = 200_000
_ALGO = "pbkdf2_sha256"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), _ITERATIONS
    ).hex()
    return f"{_ALGO}${_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
        if algo != _ALGO:
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt.encode(), int(iterations)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError):
        return False


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    now = _utcnow()
    session = AdminSession(
        token_hash=_hash_token(token),
        user_id=user.id,
        created_at=now,
        expires_at=now + timedelta(days=settings.session_days),
    )
    db.add(session)
    db.commit()
    return token


def get_user_by_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    session = db.scalar(
        select(AdminSession).where(
            AdminSession.token_hash == _hash_token(token),
            AdminSession.expires_at > _utcnow(),
        )
    )
    if session is None:
        return None
    return db.get(User, session.user_id)


def delete_session(db: Session, token: str | None) -> None:
    if not token:
        return
    session = db.scalar(
        select(AdminSession).where(AdminSession.token_hash == _hash_token(token))
    )
    if session is not None:
        db.delete(session)
        db.commit()


def seed_admin(db: Session) -> None:
    user = db.scalar(select(User).where(User.username == settings.admin_username))
    hashed = hash_password(settings.admin_password)
    if user is None:
        db.add(User(username=settings.admin_username, password_hash=hashed))
        db.commit()
        print(f"[auth] akun admin dibuat: {settings.admin_username}")
    else:
        user.password_hash = hashed
        db.commit()
