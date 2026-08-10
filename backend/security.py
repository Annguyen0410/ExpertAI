"""Boundary protections shared by API routers and middleware."""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import threading
import time
import uuid
from collections import OrderedDict, defaultdict
from typing import Final

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import (
    CORS_ORIGINS,
    CSRF_COOKIE_NAME,
    IS_PRODUCTION,
    RATE_LIMIT_MAX_KEYS,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
    SECRET_KEY,
    TRUST_PROXY_HEADERS,
)


_SCRIPTISH: Final = re.compile(r"<\s*(script|style|iframe|object|embed)[^>]*>.*?<\s*/\s*\1\s*>", re.I | re.S)
_HTML_TAG: Final = re.compile(r"<[^>]{0,500}>")
_EVENT_HANDLER: Final = re.compile(r"\bon\w+\s*=", re.I)
_CONTROL_CHARACTERS: Final = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_input(value: str, *, max_length: int = 10_000) -> str:
    """Normalize untrusted display text without treating it as HTML."""
    if not isinstance(value, str):
        return ""
    cleaned = _CONTROL_CHARACTERS.sub("", value).strip()
    cleaned = _SCRIPTISH.sub("", cleaned)
    cleaned = _HTML_TAG.sub("", cleaned)
    cleaned = re.sub(r"javascript\s*:", "", cleaned, flags=re.I)
    cleaned = _EVENT_HANDLER.sub("", cleaned)
    return cleaned[:max_length]


def validate_password(password: str) -> tuple[bool, str]:
    if not isinstance(password, str):
        return False, "Password is required"
    if len(password) < 12:
        return False, "Password must be at least 12 characters"
    if len(password) > 128:
        return False, "Password must be less than 128 characters"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, ""


def validate_email(email: str) -> tuple[bool, str]:
    if not isinstance(email, str):
        return False, "Invalid email format"
    email = email.strip().lower()
    pattern = r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
    if len(email) > 254 or not re.fullmatch(pattern, email):
        return False, "Invalid email format"
    return True, ""


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def hash_for_audit(value: str) -> str:
    """Keyed, non-reversible identifier suitable for low-sensitivity audit correlation."""
    return hmac.new(SECRET_KEY.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def hash_ip(ip: str) -> str:
    return hash_for_audit(ip or "unknown")


def get_client_ip(request: Request) -> str:
    if TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def request_fingerprint(request: Request) -> str:
    return hash_ip(get_client_ip(request))


_rate_limit_store: OrderedDict[str, list[float]] = OrderedDict()
_rate_limit_lock = threading.Lock()


def check_rate_limit(
    request: Request,
    max_requests: int = RATE_LIMIT_MAX_REQUESTS,
    window: int = RATE_LIMIT_WINDOW_SECONDS,
    bucket: str = "api",
) -> None:
    """In-memory best-effort limiter for a single process.

    The fixed cap avoids unbounded memory use. Production multi-instance
    deployments should replace this with a shared gateway or Redis limiter.
    """
    client_key = getattr(request.state, "client_key", request_fingerprint(request))
    key = f"{bucket}:{client_key}"
    now = time.monotonic()
    with _rate_limit_lock:
        timestamps = [stamp for stamp in _rate_limit_store.get(key, []) if now - stamp < window]
        if len(timestamps) >= max_requests:
            _rate_limit_store[key] = timestamps
            _rate_limit_store.move_to_end(key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again shortly.",
                headers={"Retry-After": str(window)},
            )
        timestamps.append(now)
        _rate_limit_store[key] = timestamps
        _rate_limit_store.move_to_end(key)
        while len(_rate_limit_store) > RATE_LIMIT_MAX_KEYS:
            _rate_limit_store.popitem(last=False)


def verify_csrf(request: Request) -> None:
    """Boundary integrity check for state-changing cookie-auth refresh/logout calls.

    Two modes are accepted:
    - A browser request from a configured frontend origin matches by Origin
      header. This keeps cookie refresh working when the UI and API live on
      different origins (the cookie's script-reading path cannot double-submit).
    - Everything else must satisfy double-submit (cookie value echoed in the
      X-CSRF-Token header), which remains the protection for same-origin clients
      and non-browser automation.
    """
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") in {candidate.rstrip("/") for candidate in CORS_ORIGINS}:
        return
    cookie = request.cookies.get(CSRF_COOKIE_NAME)
    header = request.headers.get("x-csrf-token")
    if not cookie or not header or not hmac.compare_digest(cookie, header):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id[:100]
        request.state.client_key = request_fingerprint(request)
        started = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            # The application exception handler safely logs the exception.
            raise
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Response-Time-Ms"] = str(int((time.monotonic() - started) * 1000))
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    _EXEMPT_PATHS = frozenset({"/health", "/ready", "/docs", "/openapi.json", "/redoc"})

    async def dispatch(self, request: Request, call_next):
        if request.url.path not in self._EXEMPT_PATHS:
            try:
                check_rate_limit(request, bucket="global")
            except HTTPException as exc:
                return JSONResponse(
                    status_code=exc.status_code,
                    content={"detail": exc.detail},
                    headers=exc.headers or {"Retry-After": str(RATE_LIMIT_WINDOW_SECONDS)},
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        if request.url.path not in {"/docs", "/openapi.json", "/redoc"}:
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
            )
        # API responses may include sensitive professional-services information.
        response.headers["Cache-Control"] = "no-store, max-age=0"
        if IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        return response
