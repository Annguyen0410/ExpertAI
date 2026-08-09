"""Database engine, session lifecycle, and additive local-schema migration."""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import DATABASE_URL

logger = logging.getLogger(__name__)

_is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,
)


if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
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

