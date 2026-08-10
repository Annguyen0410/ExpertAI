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


APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).strip().lower()
if APP_ENV not in {"development", "test", "staging", "production"}:
    raise RuntimeError("APP_ENV must be development, test, staging, or production")
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
DOCUMENT_STORAGE_MODE = os.getenv(
    "DOCUMENT_STORAGE_MODE", "gcs" if IS_PRODUCTION else "local"
).strip().lower()
if DOCUMENT_STORAGE_MODE not in {"local", "gcs"}:
    raise RuntimeError("DOCUMENT_STORAGE_MODE must be local or gcs")
if IS_PRODUCTION and DOCUMENT_STORAGE_MODE == "local":
    raise RuntimeError("Production document storage must use a managed GCS bucket")
if DOCUMENT_STORAGE_MODE == "gcs" and not GCS_BUCKET_NAME:
    raise RuntimeError("GCS_BUCKET_NAME is required when DOCUMENT_STORAGE_MODE=gcs")
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

# Public users may never choose an elevated role. A deployment can create a
# time-bounded professional onboarding code outside source control.
PROFESSIONAL_INVITE_CODE = os.getenv("PROFESSIONAL_INVITE_CODE", "")

B2C_PRICE_ID = os.getenv("B2C_PRICE_ID", "")
B2B_PRICE_ID = os.getenv("B2B_PRICE_ID", "")
B2C_PRICE = _int_env("B2C_PRICE", 1900, minimum=0, maximum=10_000_000)
B2B_PRICE = _int_env("B2B_PRICE", 9900, minimum=0, maximum=10_000_000)
