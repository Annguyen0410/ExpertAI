"""Database engine, session lifecycle, and additive local-schema migration."""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import (
    DATABASE_URL,
    DB_POOL_MAX_OVERFLOW,
    DB_POOL_RECYCLE_SECONDS,
    DB_POOL_SIZE,
)

logger = logging.getLogger(__name__)

_is_sqlite = DATABASE_URL.startswith("sqlite")
if _is_sqlite:
    # Local development: a single SQLite file with WAL gives concurrent readers
    # and a busy-timeout instead of immediate "database is locked" errors when
    # several requests run at once.
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    # Managed databases: bounded pool so a busy API never exhausts the server's
    # connection limit, with pre-ping and recycling to survive restarts.
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_POOL_MAX_OVERFLOW,
        pool_recycle=DB_POOL_RECYCLE_SECONDS,
    )


if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _configure_sqlite_connection(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# SQLite is used for local development.  These migrations are intentionally
# additive so developers can start the upgraded app against an existing local
# database. Production databases should use reviewed, versioned migrations.
_SQLITE_ADDITIVE_COLUMNS: dict[str, dict[str, str]] = {
    "documents": {
        "size_bytes": "INTEGER",
        "sha256": "VARCHAR(64)",
        "processing_status": "VARCHAR(32) NOT NULL DEFAULT 'uploaded'",
        "analysis_summary": "TEXT",
        "analyzed_at": "DATETIME",
    },
    "agent_execution_logs": {
        "status": "VARCHAR(32) NOT NULL DEFAULT 'completed'",
    },
}


def migrate_schema() -> None:
    """Apply safe, additive SQLite updates for databases created by old demos."""
    if not _is_sqlite:
        logger.info("Non-SQLite database detected; use managed schema migrations for changes")
        return

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if not existing_tables:
        return

    with engine.begin() as connection:
        for table_name, expected_columns in _SQLITE_ADDITIVE_COLUMNS.items():
            if table_name not in existing_tables:
                continue
            known_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_definition in expected_columns.items():
                if column_name not in known_columns:
                    connection.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")
                    )
                    logger.info("Applied local additive migration %s.%s", table_name, column_name)

