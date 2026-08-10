"""Authentication, authorization, session rotation, and audit helpers."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    JWT_AUDIENCE,
    JWT_ISSUER,
    REFRESH_TOKEN_EXPIRE_DAYS,
    SECRET_KEY,
)
from database import get_db
from models import RefreshToken, SecurityEvent, User, UserRole
from security import get_client_ip, hash_ip


# bcrypt_sha256 avoids bcrypt's 72-byte password truncation while retaining
# verification support for hashes written by the original application.
pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

FAILED_LOGIN_LIMIT = 8
ACCOUNT_LOCKOUT_MINUTES = 15


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def is_account_locked(user: User) -> bool:
    locked_until = _as_utc(user.locked_until)
    return bool(locked_until and locked_until > utcnow())


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except (ValueError, TypeError):
        return False


def _encode_token(data: dict, token_type: str, expires_at: datetime) -> str:
    issued_at = utcnow()
    claims = data.copy()
    claims.update(
        {
            "exp": expires_at,
            "iat": issued_at,
            "nbf": issued_at,
            "iss": JWT_ISSUER,
            "aud": JWT_AUDIENCE,
            "type": token_type,
            "jti": secrets.token_urlsafe(24),
        }
    )
    return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(data: dict) -> str:
    return _encode_token(
        data,
        "access",
        utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(data: dict) -> str:
    return _encode_token(
        data,
        "refresh",
        utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def refresh_token_hash(token_or_jti: str) -> str:
    return hashlib.sha256(token_or_jti.encode("utf-8")).hexdigest()


def _refresh_expiration(payload: dict) -> datetime:
    value = payload.get("exp")
    if not isinstance(value, (int, float)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return datetime.fromtimestamp(value, tz=timezone.utc)


def issue_refresh_token(user: User, db: Session) -> tuple[str, datetime]:
    token = create_refresh_token({"sub": user.id, "ver": user.token_version})
    payload = decode_token(token)
    jti = payload.get("jti")
    if not isinstance(jti, str):  # Defensive; tokens are generated locally.
        raise RuntimeError("Refresh token missing jti")
    expires_at = _refresh_expiration(payload)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_token_hash(jti),
            expires_at=expires_at,
        )
    )
    return token, expires_at


def rotate_refresh_token(raw_token: str, db: Session) -> tuple[User, str, datetime]:
    payload = decode_token(raw_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user_id = payload.get("sub")
    token_version = payload.get("ver")
    jti = payload.get("jti")
    if not isinstance(user_id, str) or not isinstance(jti, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    now = utcnow()
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == refresh_token_hash(jti))
        .with_for_update()
        .first()
    )
    if not record or record.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session not found")
    record_expires_at = _as_utc(record.expires_at)
    if record.used_at or record.revoked_at or not record_expires_at or record_expires_at <= now:
        # Reuse may indicate a copied refresh token. Invalidate the user's
        # remaining refresh sessions to limit the impact.
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        ).update({RefreshToken.revoked_at: now}, synchronize_session=False)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is no longer valid")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or token_version != user.token_version:
        record.revoked_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is no longer valid")

    locked_until = _as_utc(user.locked_until)
    if locked_until and locked_until > now:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Account is temporarily locked")

    new_token, expires_at = issue_refresh_token(user, db)
    new_payload = decode_token(new_token)
    record.used_at = now
    record.revoked_at = now
    record.replaced_by_hash = refresh_token_hash(str(new_payload["jti"]))
    db.commit()
    return user, new_token, expires_at


def revoke_user_refresh_tokens(user_id: str, db: Session) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    ).update({RefreshToken.revoked_at: utcnow()}, synchronize_session=False)


def log_security_event(
    db: Session,
    event_type: str,
    user_id: str | None = None,
    request: Request | None = None,
    details: str | None = None,
    severity: str = "info",
) -> None:
    """Stage a privacy-minimized audit event in the caller's transaction."""
    db.add(
        SecurityEvent(
            event_type=event_type[:100],
            user_id=user_id,
            ip_address=hash_ip(get_client_ip(request)) if request else None,
            user_agent=(request.headers.get("user-agent", "")[:500] if request else None),
            details=(details or "")[:1_000] or None,
            severity=severity[:32],
        )
    )


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    return _validate_user(credentials.credentials, request, db)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return _validate_user(credentials.credentials, request, db)


def _validate_user(token: str, request: Request, db: Session) -> User:
    payload = decode_token(token)
    user_id = payload.get("sub")
    token_type = payload.get("type")
    token_version = payload.get("ver")
    if not isinstance(user_id, str) or token_type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    locked_until = _as_utc(user.locked_until)
    if locked_until and locked_until > utcnow():
        log_security_event(db, "locked_account_access_attempt", user.id, request, severity="warning")
        db.commit()
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Account is temporarily locked")
    if token_version != user.token_version:
        log_security_event(db, "revoked_access_token_used", user.id, request, severity="warning")
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has expired. Please sign in again.")
    return user


def require_role(required_roles: list[UserRole]):
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in required_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return role_checker


def handle_failed_login(user: User, request: Request, db: Session) -> None:
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    log_security_event(
        db,
        "failed_login",
        user.id,
        request,
        details=f"attempt={user.failed_login_attempts}",
        severity="warning",
    )
    if user.failed_login_attempts >= FAILED_LOGIN_LIMIT:
        user.locked_until = utcnow() + timedelta(minutes=ACCOUNT_LOCKOUT_MINUTES)
        log_security_event(db, "account_locked", user.id, request, severity="high")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to too many failed attempts.",
            headers={"Retry-After": str(ACCOUNT_LOCKOUT_MINUTES * 60)},
        )
    db.commit()


def reset_login_attempts(user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
