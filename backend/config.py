"""Centralized, fail-closed runtime configuration for the API."""

from __future__ import annotations

import logging
import os
import secrets
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
# Load the backend-specific development file without overriding deployment
# environment variables injected by a platform or container runtime.
load_dotenv(BASE_DIR / ".env")

logger = logging.getLogger(__name__)


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be a boolean value")


def _int_env(name: str, default: int, *, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} must be between {minimum} and {maximum}")
    return value


def _csv_env(name: str, default: str = "") -> list[str]:
    return [item.strip().rstrip("/") for item in os.getenv(name, default).split(",") if item.strip()]


def _resolve_app_env() -> str:
    """Resolve the runtime environment, tolerating common platform values.

    Hosted platforms (e.g. Render) inject RENDER=true. There, the strict
    production mode is the only sane default, so unrecognized or missing
    values resolve to production (fail-safe: every production security gate
    still applies) instead of hard-crashing the worker.
    """
    raw = (os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or "").strip().lower()
    on_render = bool(os.getenv("RENDER"))

    if not raw:
        if on_render:
            logger.warning("APP_ENV is not set on Render; defaulting to production")
            return "production"
        return "development"

    normalized = {"dev": "development", "prod": "production"}.get(raw, raw)
    if normalized not in {"development", "test", "staging", "production"}:
        if on_render:
            logger.warning("Unrecognized APP_ENV %r on Render; defaulting to production", raw)
            return "production"
        raise RuntimeError(
            f"APP_ENV must be development, test, staging, or production (got {raw!r})"
        )

    if normalized == "development" and on_render:
        raise RuntimeError(
            "APP_ENV is 'development' on Render. Set APP_ENV=production (or staging) "
            "in the service environment before deploying."
        )
    return normalized


APP_ENV = _resolve_app_env()
IS_PRODUCTION = APP_ENV == "production"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'expertai.db'}")

_placeholder_secrets = {
    "your-super-secret-key-change-in-production",
    "change-me",
    "secret",
    "example",
}
_configured_secret = os.getenv("SECRET_KEY", "").strip()
if not _configured_secret:
    if IS_PRODUCTION:
        raise RuntimeError("SECRET_KEY must be configured in production")
    SECRET_KEY = secrets.token_hex(32)
    logger.warning("SECRET_KEY is not configured; development sessions will end on restart")
elif IS_PRODUCTION and (
    _configured_secret.lower() in _placeholder_secrets or len(_configured_secret) < 32
):
    raise RuntimeError("SECRET_KEY must be a unique value of at least 32 characters in production")
else:
    SECRET_KEY = _configured_secret

ALGORITHM = "HS256"
JWT_ISSUER = os.getenv("JWT_ISSUER", "expertai-api").strip()
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "expertai-web").strip()
if not JWT_ISSUER or not JWT_AUDIENCE:
    raise RuntimeError("JWT_ISSUER and JWT_AUDIENCE must not be empty")

ACCESS_TOKEN_EXPIRE_MINUTES = _int_env(
    "ACCESS_TOKEN_EXPIRE_MINUTES", 15, minimum=5, maximum=24 * 60
)
REFRESH_TOKEN_EXPIRE_DAYS = _int_env("REFRESH_TOKEN_EXPIRE_DAYS", 7, minimum=1, maximum=90)
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "expertai_refresh").strip()
if not REFRESH_COOKIE_NAME or any(char.isspace() for char in REFRESH_COOKIE_NAME):
    raise RuntimeError("REFRESH_COOKIE_NAME must be a valid cookie name")
REFRESH_COOKIE_SECURE = _bool_env("REFRESH_COOKIE_SECURE", IS_PRODUCTION)
REFRESH_COOKIE_SAMESITE = os.getenv("REFRESH_COOKIE_SAMESITE", "lax").strip().lower()
if REFRESH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("REFRESH_COOKIE_SAMESITE must be lax, strict, or none")
if IS_PRODUCTION and not REFRESH_COOKIE_SECURE:
    raise RuntimeError("REFRESH_COOKIE_SECURE must be enabled in production")
if REFRESH_COOKIE_SAMESITE == "none" and not REFRESH_COOKIE_SECURE:
    raise RuntimeError("SameSite=None refresh cookies require REFRESH_COOKIE_SECURE=true")
# The cookie is the production transport. These switches provide a controlled
# development migration path for an existing localStorage-based client.
RETURN_REFRESH_TOKEN_IN_BODY = _bool_env("RETURN_REFRESH_TOKEN_IN_BODY", not IS_PRODUCTION)
ALLOW_LEGACY_REFRESH_BODY = _bool_env("ALLOW_LEGACY_REFRESH_BODY", not IS_PRODUCTION)
CSRF_COOKIE_NAME = os.getenv("CSRF_COOKIE_NAME", "expertai_csrf").strip()
if not CSRF_COOKIE_NAME or any(char.isspace() for char in CSRF_COOKIE_NAME):
    raise RuntimeError("CSRF_COOKIE_NAME must be a valid cookie name")

_default_cors = "http://localhost:3000,http://localhost:3001" if not IS_PRODUCTION else ""
CORS_ORIGINS = _csv_env("CORS_ORIGINS", _default_cors)
if not CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS must contain at least one trusted origin")
for origin in CORS_ORIGINS:
    parsed = urlparse(origin)
    if origin == "*" or parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError("CORS_ORIGINS must contain explicit http(s) origins, never '*'")
    if IS_PRODUCTION and parsed.scheme != "https":
        raise RuntimeError("CORS_ORIGINS must use https in production")

_default_hosts = "localhost,127.0.0.1,testserver,[::1]" if not IS_PRODUCTION else ""
TRUSTED_HOSTS = _csv_env("TRUSTED_HOSTS", _default_hosts)
if not TRUSTED_HOSTS:
    raise RuntimeError("TRUSTED_HOSTS must be configured in production")
if "*" in TRUSTED_HOSTS and IS_PRODUCTION:
    raise RuntimeError("TRUSTED_HOSTS must not include '*' in production")

ENABLE_DOCS = _bool_env("ENABLE_DOCS", not IS_PRODUCTION)
TRUST_PROXY_HEADERS = _bool_env("TRUST_PROXY_HEADERS", False)
RATE_LIMIT_MAX_REQUESTS = _int_env("RATE_LIMIT_MAX_REQUESTS", 60, minimum=1, maximum=10_000)
RATE_LIMIT_WINDOW_SECONDS = _int_env("RATE_LIMIT_WINDOW_SECONDS", 60, minimum=1, maximum=3600)
RATE_LIMIT_MAX_KEYS = _int_env("RATE_LIMIT_MAX_KEYS", 20_000, minimum=100, maximum=1_000_000)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Optional manual override; when empty the backend rotates across available models.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "").strip()
# Production prefers GCS, but falls back to the instance filesystem when no
# bucket is configured so deployments without managed cloud storage (e.g.
# Render free instances) can still boot. Local uploads live in
# DOCUMENT_STORAGE_DIR and are lost when the instance is recycled.
DOCUMENT_STORAGE_MODE = os.getenv(
    "DOCUMENT_STORAGE_MODE", "gcs" if IS_PRODUCTION and GCS_BUCKET_NAME else "local"
).strip().lower()
if DOCUMENT_STORAGE_MODE not in {"local", "gcs"}:
    raise RuntimeError("DOCUMENT_STORAGE_MODE must be local or gcs")
if DOCUMENT_STORAGE_MODE == "gcs" and not GCS_BUCKET_NAME:
    raise RuntimeError("GCS_BUCKET_NAME is required when DOCUMENT_STORAGE_MODE=gcs")
if IS_PRODUCTION and DOCUMENT_STORAGE_MODE == "local":
    logger.warning(
        "Document storage is LOCAL in production; uploads are lost when the "
        "instance is recycled. Set GCS_BUCKET_NAME to persist documents."
    )
_default_document_storage_dir = "/tmp/expertai-uploads" if DOCUMENT_STORAGE_MODE == "gcs" else str(BASE_DIR / "uploads")
DOCUMENT_STORAGE_DIR = Path(
    os.getenv("DOCUMENT_STORAGE_DIR", "").strip() or _default_document_storage_dir
).resolve()
MAX_DOCUMENT_BYTES = _int_env("MAX_DOCUMENT_BYTES", 10 * 1024 * 1024, minimum=1_024, maximum=50 * 1024 * 1024)

APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3000").strip().rstrip("/")
_app_url = urlparse(APP_BASE_URL)
if _app_url.scheme not in {"http", "https"} or not _app_url.netloc:
    raise RuntimeError("APP_BASE_URL must be a valid absolute http(s) URL")
if IS_PRODUCTION and _app_url.scheme != "https":
    raise RuntimeError("APP_BASE_URL must use https in production")

# Transactional email — prefer Resend; SMTP is the fallback. Password-reset
# tokens must only leave the server over email (never in API JSON).
EMAIL_FROM = os.getenv("EMAIL_FROM", "ExpertAI <noreply@expertai.io>").strip()
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = _int_env("SMTP_PORT", 587, minimum=1, maximum=65535)
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_USE_TLS = _bool_env("SMTP_USE_TLS", True)
if IS_PRODUCTION and not RESEND_API_KEY and not SMTP_HOST:
    logger.warning(
        "No email provider configured (RESEND_API_KEY or SMTP_HOST). "
        "Password reset emails will not be delivered."
    )

# Public users may never choose an elevated role. A deployment can create a
# time-bounded professional onboarding code outside source control.
PROFESSIONAL_INVITE_CODE = os.getenv("PROFESSIONAL_INVITE_CODE", "")

# Optional bootstrap: emails listed here are automatically promoted to the
# given role on signup and sign-in. Comma-separated. Intended to let a
# deployment owner create admin / professional accounts without touching the DB.
def _email_set(value: str) -> set[str]:
    return {e.strip().lower() for e in value.split(",") if e.strip()}

ADMIN_EMAILS = _email_set(os.getenv("ADMIN_EMAILS", ""))
PROFESSIONAL_EMAILS = _email_set(os.getenv("PROFESSIONAL_EMAILS", ""))

# Connection pool tuning for managed databases. Sane defaults for a
# single-worker API on typical PaaS instances; raise when scaling out.
DB_POOL_SIZE = _int_env("DB_POOL_SIZE", 5, minimum=1, maximum=100)
DB_POOL_MAX_OVERFLOW = _int_env("DB_POOL_MAX_OVERFLOW", 10, minimum=0, maximum=200)
DB_POOL_RECYCLE_SECONDS = _int_env("DB_POOL_RECYCLE_SECONDS", 1800, minimum=60, maximum=86400)

B2C_PRICE_ID = os.getenv("B2C_PRICE_ID", "")
B2B_PRICE_ID = os.getenv("B2B_PRICE_ID", "")
B2C_PRICE = _int_env("B2C_PRICE", 1900, minimum=0, maximum=10_000_000)
B2B_PRICE = _int_env("B2B_PRICE", 9900, minimum=0, maximum=10_000_000)
