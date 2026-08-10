"""Public auth endpoints and authenticated account lifecycle endpoints."""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session

from auth import (
    ACCOUNT_LOCKOUT_MINUTES,
    create_access_token,
    decode_token,
    get_current_user,
    handle_failed_login,
    hash_password,
    is_account_locked,
    issue_refresh_token,
    log_security_event,
    refresh_token_hash,
    reset_login_attempts,
    revoke_user_refresh_tokens,
    rotate_refresh_token,
    security,
    utcnow,
    verify_password,
)
from config import (
    ALLOW_LEGACY_REFRESH_BODY,
    APP_BASE_URL,
    APP_ENV,
    CSRF_COOKIE_NAME,
    PROFESSIONAL_INVITE_CODE,
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_SAMESITE,
    REFRESH_COOKIE_SECURE,
    REFRESH_TOKEN_EXPIRE_DAYS,
    RETURN_REFRESH_TOKEN_IN_BODY,
)
from database import get_db
from models import (
    PasswordResetToken,
    Query,
    QueryStatus,
    RefreshToken,
    RevenueEvent,
    SubscriptionTier,
    User,
    UserRole,
)
from security import check_rate_limit, generate_csrf_token, sanitize_input, validate_email, validate_password, verify_csrf


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
PASSWORD_RESET_EXPIRE_MINUTES = 30
_GENERIC_RESET_MESSAGE = (
    "If an account exists for that email, password reset instructions have been sent."
)


class SignUpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: str
    password: str
    name: str
    role: UserRole = UserRole.individual
    professional_title: str | None = None
    professional_license: str | None = None
    professional_invite_code: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, value: str) -> str:
        valid, message = validate_email(value)
        if not valid:
            raise ValueError(message)
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_field(cls, value: str) -> str:
        valid, message = validate_password(value)
        if not valid:
            raise ValueError(message)
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = sanitize_input(value, max_length=100)
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("professional_title", "professional_license")
    @classmethod
    def sanitize_professional_fields(cls, value: str | None) -> str | None:
        return sanitize_input(value, max_length=160) if value else None


class SignInRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str | None = None


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = sanitize_input(value, max_length=100)
        if not value:
            raise ValueError("Name cannot be empty")
        return value


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        valid, message = validate_password(value)
        if not valid:
            raise ValueError(message)
        return value


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        valid, message = validate_password(value)
        if not valid:
            raise ValueError(message)
        return value


class AuthResponse(BaseModel):
    token: str
    refresh_token: str | None = None
    user_id: str
    email: str
    name: str
    role: str
    subscription_tier: str


def _password_reset_token_hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _issue_password_reset(user: User, db: Session) -> str:
    raw_token = secrets.token_urlsafe(32)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: utcnow()}, synchronize_session=False)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_password_reset_token_hash(raw_token),
            expires_at=utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES),
        )
    )
    return raw_token


def _set_session_cookies(response: Response, refresh_token: str) -> None:
    cookie_seconds = int(timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS).total_seconds())
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=cookie_seconds,
        httponly=True,
        secure=REFRESH_COOKIE_SECURE,
        samesite=REFRESH_COOKIE_SAMESITE,
        path="/auth",
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=generate_csrf_token(),
        max_age=cookie_seconds,
        httponly=False,
        secure=REFRESH_COOKIE_SECURE,
        samesite=REFRESH_COOKIE_SAMESITE,
        path="/auth",
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/auth")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/auth")


def _issue_session(user: User, response: Response, db: Session) -> AuthResponse:
    access_token = create_access_token({"sub": user.id, "email": user.email, "ver": user.token_version})
    refresh_token, _ = issue_refresh_token(user, db)
    _set_session_cookies(response, refresh_token)
    return AuthResponse(
        token=access_token,
        refresh_token=refresh_token if RETURN_REFRESH_TOKEN_IN_BODY else None,
        user_id=user.id,
        email=user.email,
        name=user.name or "",
        role=user.role.value,
        subscription_tier=user.subscription_tier.value,
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(req: SignUpRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    check_rate_limit(request, max_requests=5, window=60, bucket="signup")
    if req.role == UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrative accounts cannot be self-registered")
    if req.role == UserRole.professional:
        if not PROFESSIONAL_INVITE_CODE or not req.professional_invite_code or not hmac.compare_digest(
            req.professional_invite_code, PROFESSIONAL_INVITE_CODE
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Professional onboarding requires a valid invitation")
        if not req.professional_title or not req.professional_license:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Professional title and license are required")

    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account already exists for this email")

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        name=req.name,
        role=req.role,
        professional_title=req.professional_title if req.role == UserRole.professional else None,
        professional_license=req.professional_license if req.role == UserRole.professional else None,
    )
    db.add(user)
    db.flush()
    payload = _issue_session(user, response, db)
    log_security_event(db, "signup", user.id, request)
    db.commit()
    return payload


@router.post("/signin", response_model=AuthResponse)
def signin(req: SignInRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    check_rate_limit(request, max_requests=10, window=60, bucket="signin")
    user = db.query(User).filter(User.email == req.email).first()
    # Keep the public error consistent to limit account enumeration.
    if not user or not verify_password(req.password, user.hashed_password):
        if user:
            handle_failed_login(user, request, db)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if is_account_locked(user):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account temporarily locked. Try again in {ACCOUNT_LOCKOUT_MINUTES} minutes.",
            headers={"Retry-After": str(ACCOUNT_LOCKOUT_MINUTES * 60)},
        )

    reset_login_attempts(user)
    payload = _issue_session(user, response, db)
    log_security_event(db, "signin", user.id, request)
    db.commit()
    return payload


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Always return the same message so callers cannot probe for account existence."""
    check_rate_limit(request, max_requests=5, window=60, bucket="forgot-password")
    valid, _ = validate_email(req.email)
    payload = {"status": "ok", "message": _GENERIC_RESET_MESSAGE}
    if not valid:
        return payload

    user = db.query(User).filter(User.email == req.email).first()
    if user:
        raw_token = _issue_password_reset(user, db)
        reset_url = f"{APP_BASE_URL}/reset-password?token={raw_token}"
        log_security_event(db, "password_reset_requested", user.id, request, severity="high")
        db.commit()
        # Email delivery is optional until SMTP is configured. The reset URL is
        # always logged so operators can recover a locked customer manually.
        logger.info("Password reset link for %s: %s", user.email, reset_url)
        if APP_ENV != "production":
            payload["dev_reset_url"] = reset_url
    else:
        log_security_event(db, "password_reset_unknown_email", None, request, details=req.email[:80])
        db.commit()
    return payload


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, max_requests=5, window=60, bucket="reset-password")
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == _password_reset_token_hash(req.token))
        .first()
    )
    now = utcnow()
    if not record or record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Request a new one.",
        )
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=now.tzinfo)
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Request a new one.",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid or has expired.")

    user.hashed_password = hash_password(req.new_password)
    user.token_version = (user.token_version or 1) + 1
    user.failed_login_attempts = 0
    user.locked_until = None
    record.used_at = now
    revoke_user_refresh_tokens(user.id, db)
    log_security_event(db, "password_reset_completed", user.id, request, severity="high")
    db.commit()
    return {"status": "ok", "message": "Password updated. You can sign in with your new password."}


@router.post("/refresh", response_model=AuthResponse)
def refresh_token(request: Request, response: Response, req: RefreshRequest | None = None, db: Session = Depends(get_db)):
    cookie_token = request.cookies.get(REFRESH_COOKIE_NAME)
    raw_token = cookie_token or (req.refresh_token if req else None)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is required")
    if cookie_token:
        verify_csrf(request)
    elif not ALLOW_LEGACY_REFRESH_BODY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is required")

    user, new_refresh, _ = rotate_refresh_token(raw_token, db)
    _set_session_cookies(response, new_refresh)
    log_security_event(db, "token_rotated", user.id, request)
    db.commit()
    return AuthResponse(
        token=create_access_token({"sub": user.id, "email": user.email, "ver": user.token_version}),
        refresh_token=new_refresh if RETURN_REFRESH_TOKEN_IN_BODY else None,
        user_id=user.id,
        email=user.email,
        name=user.name or "",
        role=user.role.value,
        subscription_tier=user.subscription_tier.value,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, req: RefreshRequest | None = None, db: Session = Depends(get_db)):
    cookie_token = request.cookies.get(REFRESH_COOKIE_NAME)
    raw_token = cookie_token or (req.refresh_token if req else None)
    if cookie_token:
        verify_csrf(request)
    if raw_token:
        try:
            payload = decode_token(raw_token)
            jti = payload.get("jti")
            if isinstance(jti, str):
                record = db.query(RefreshToken).filter(RefreshToken.token_hash == refresh_token_hash(jti)).first()
                if record and not record.revoked_at:
                    record.revoked_at = utcnow()
                    log_security_event(db, "logout", record.user_id, request)
                    db.commit()
        except HTTPException:
            # Logout remains idempotent and clears client state even for a stale token.
            pass
    _clear_session_cookies(response)
    return None


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "subscription_tier": user.subscription_tier.value,
        "subscription_active": user.subscription_active,
        "professional_title": user.professional_title,
        "professional_license": user.professional_license,
    }


@router.put("/profile")
def update_profile(req: UpdateProfileRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.name is not None:
        user.name = req.name
        db.commit()
    return {"status": "updated", "name": user.name}


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(request, max_requests=5, window=60, bucket="password-change")
    if not verify_password(req.current_password, user.hashed_password):
        log_security_event(db, "failed_password_change", user.id, request, severity="warning")
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.hashed_password = hash_password(req.new_password)
    user.token_version = (user.token_version or 1) + 1
    revoke_user_refresh_tokens(user.id, db)
    log_security_event(db, "password_changed", user.id, request, severity="high")
    db.commit()
    return {"status": "password_changed", "message": "Please sign in again on this and other devices."}


@router.get("/usage")
def get_usage(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    base_query = db.query(Query).filter(Query.user_id == user.id)
    total_queries = base_query.count()
    completed = base_query.filter(Query.status == QueryStatus.completed).count()
    escalated = base_query.filter(Query.is_escalated.is_(True)).count()
    by_domain_rows = db.query(Query.domain).filter(Query.user_id == user.id).all()
    domain_counts: dict[str, int] = {}
    for (domain,) in by_domain_rows:
        domain_counts[domain] = domain_counts.get(domain, 0) + 1

    tier_limit = 3 if user.subscription_tier == SubscriptionTier.free and not user.subscription_active else None
    return {
        "total_queries": total_queries,
        "completed": completed,
        "escalated": escalated,
        "queries_by_domain": domain_counts,
        "quota_limit": tier_limit,
        "queries_remaining": max(0, tier_limit - total_queries) if tier_limit is not None else None,
        "subscription_tier": user.subscription_tier.value,
        "subscription_active": user.subscription_active,
    }


@router.get("/billing")
def get_billing(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    events = (
        db.query(RevenueEvent)
        .filter(RevenueEvent.user_id == user.id)
        .order_by(RevenueEvent.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "subscription_tier": user.subscription_tier.value,
        "subscription_active": user.subscription_active,
        "events": [
            {
                "id": event.id,
                "event_type": event.event_type,
                "amount_dollars": round(event.amount_cents / 100, 2),
                "description": event.description,
                "created_at": event.created_at.isoformat(),
            }
            for event in events
        ],
    }
