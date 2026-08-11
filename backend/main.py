"""ExpertAI FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from config import APP_ENV, CORS_ORIGINS, DOCUMENT_STORAGE_DIR, ENABLE_DOCS, TRUSTED_HOSTS
from database import Base, engine, migrate_schema
from security import RateLimitMiddleware, RequestContextMiddleware, SecurityHeadersMiddleware


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("expertai.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Additive local migration runs before metadata creation so an existing
    # SQLite database receives the columns needed by the upgraded models.
    migrate_schema()
    Base.metadata.create_all(bind=engine)
    DOCUMENT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("application_started env=%s", APP_ENV, extra={"request_id": "startup"})
    yield
    engine.dispose()
    logger.info("application_stopped", extra={"request_id": "shutdown"})


app = FastAPI(
    title="ExpertAI API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

# TrustedHost is intentionally outermost; only explicit production hosts are
# accepted. CORS allows only configured browser origins, never a wildcard.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=TRUSTED_HOSTS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-Response-Time-Ms"],
    max_age=600,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestContextMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Pydantic errors are useful to clients but should not echo full invalid
    # request values, which can contain sensitive professional information.
    logger.info(
        "request_validation_failed path=%s errors=%s",
        request.url.path,
        len(exc.errors()),
        extra={"request_id": getattr(request.state, "request_id", "unknown")},
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation failed", "errors": [{"loc": error.get("loc"), "msg": error.get("msg")} for error in exc.errors()]},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "unhandled_api_error path=%s type=%s",
        request.url.path,
        exc.__class__.__name__,
        extra={"request_id": getattr(request.state, "request_id", "unknown")},
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Please try again later."},
    )


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "version": app.version, "service": "ExpertAI"}


@app.get("/ready", tags=["health"])
def ready():
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
    except Exception as exc:
        logger.warning("readiness_database_failure type=%s", exc.__class__.__name__, extra={"request_id": "readiness"})
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"status": "not_ready"})
    return {"status": "ready"}


from routers import agents, analytics, auth, documents, professional, subscriptions  # noqa: E402

app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(subscriptions.router)
app.include_router(documents.router)
app.include_router(analytics.router)
app.include_router(professional.router)
