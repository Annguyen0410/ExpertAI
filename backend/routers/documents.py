"""Secure document storage and analysis endpoints."""

from __future__ import annotations

import hashlib
import io
import os
import re
import shutil
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path, PurePath

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from agents.base import AgentExecutionError
from agents.operations import DocumentAnalysisAgent
from auth import get_current_user
from config import DOCUMENT_STORAGE_DIR, DOCUMENT_STORAGE_MODE, GCS_BUCKET_NAME, MAX_DOCUMENT_BYTES
from database import get_db
from models import AgentExecutionLog, Document, Query, User
from security import check_rate_limit, hash_for_audit, sanitize_input


router = APIRouter(prefix="/documents", tags=["documents"])
document_agent = DocumentAnalysisAgent()

_TYPE_SIGNATURES = {
    "application/pdf": lambda data: data.startswith(b"%PDF-"),
    "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "image/gif": lambda data: data.startswith((b"GIF87a", b"GIF89a")),
}
_EXTENSIONS = {
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
}
ALLOWED_TYPES = set(_EXTENSIONS)


def _safe_filename(filename: str | None, content_type: str) -> str:
    raw_name = PurePath(filename or "document").name
    raw_name = sanitize_input(raw_name, max_length=180)
    stem = Path(raw_name).stem or "document"
    stem = re.sub(r"[^A-Za-z0-9._ -]+", "_", stem).strip(" ._")[:120] or "document"
    return f"{stem}{_EXTENSIONS[content_type]}"


def _is_valid_content(content_type: str, header: bytes) -> bool:
    if content_type == "text/plain":
        # Reject binary payloads masquerading as text. The UTF-8 decoder still
        # handles ordinary text with replacement during analysis.
        return b"\x00" not in header
    validator = _TYPE_SIGNATURES.get(content_type)
    return bool(validator and validator(header))


def _storage_key(user_id: str, query_id: str, document_id: str, filename: str) -> str:
    return f"uploads/{user_id}/{query_id}/{document_id}_{filename}"


def _local_path(storage_key: str) -> Path:
    base = DOCUMENT_STORAGE_DIR.resolve()
    target = (base / storage_key).resolve()
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document storage path") from exc
    return target


def _upload_to_gcs(temp_path: Path, storage_key: str, content_type: str) -> str:
    try:
        from google.cloud import storage

        client = storage.Client()
        blob = client.bucket(GCS_BUCKET_NAME).blob(storage_key)
        blob.upload_from_filename(str(temp_path), content_type=content_type, timeout=60)
        return f"gs://{GCS_BUCKET_NAME}/{storage_key}"
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document storage is temporarily unavailable. Please try again.",
        ) from exc


def _read_document_bytes(document: Document) -> bytes:
    storage_uri = document.gcs_path or ""
    if storage_uri.startswith("local://"):
        relative_key = storage_uri.removeprefix("local://")
        path = _local_path(relative_key)
        if not path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored document is no longer available")
        return path.read_bytes()
    if storage_uri.startswith("gs://"):
        try:
            from google.cloud import storage

            bucket_and_key = storage_uri.removeprefix("gs://").split("/", 1)
            if len(bucket_and_key) != 2:
                raise ValueError("Malformed storage URI")
            return storage.Client().bucket(bucket_and_key[0]).blob(bucket_and_key[1]).download_as_bytes(timeout=60)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Document storage is temporarily unavailable") from exc
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored document is no longer available")


def _extract_text(document: Document, content: bytes) -> str:
    if document.content_type == "text/plain":
        return content.decode("utf-8", errors="replace")[:24_000]
    if document.content_type == "application/pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content))
            text = "\n".join((page.extract_text() or "") for page in reader.pages[:40])
            if not text.strip():
                raise ValueError("No extractable text")
            return text[:24_000]
        except ImportError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PDF analysis is not available until the server dependencies are installed.",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="This PDF does not contain extractable text. Upload a text-based PDF or text file.",
            ) from exc
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Image analysis is not enabled for this deployment. Upload a text-based PDF or text file.",
    )


def _log_document_event(
    db: Session,
    query_id: str,
    action: str,
    decision: str,
    *,
    execution_status: str = "completed",
    details: str | None = None,
) -> None:
    db.add(
        AgentExecutionLog(
            query_id=query_id,
            agent_name="DocumentAnalysisAgent",
            action=action,
            decision=decision,
            status=execution_status,
            output_data=(details or "")[:500] or None,
        )
    )


@router.post("/upload/{query_id}", status_code=status.HTTP_201_CREATED)
async def upload_document(
    query_id: str,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(request, max_requests=10, window=60, bucket="document-upload")
    query = db.query(Query).filter(Query.id == query_id, Query.user_id == user.id).first()
    if not query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")

    claimed_type = (file.content_type or "").lower().strip()
    if claimed_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF, plain text, PNG, JPEG, and GIF files are allowed")

    DOCUMENT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    temp_fd, temp_name = tempfile.mkstemp(prefix="expertai-upload-", dir=DOCUMENT_STORAGE_DIR)
    os.close(temp_fd)
    temp_path = Path(temp_name)
    digest = hashlib.sha256()
    total_size = 0
    header = b""
    try:
        with temp_path.open("wb") as output:
            while chunk := await file.read(64 * 1024):
                total_size += len(chunk)
                if total_size > MAX_DOCUMENT_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the {MAX_DOCUMENT_BYTES // (1024 * 1024)}MB limit",
                    )
                if len(header) < 32:
                    header += chunk[: 32 - len(header)]
                digest.update(chunk)
                output.write(chunk)
        if not total_size:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The uploaded file is empty")
        if not _is_valid_content(claimed_type, header):
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File content does not match its declared type")

        document_id = str(uuid.uuid4())
        filename = _safe_filename(file.filename, claimed_type)
        storage_key = _storage_key(user.id, query.id, document_id, filename)
        if DOCUMENT_STORAGE_MODE == "gcs":
            storage_uri = _upload_to_gcs(temp_path, storage_key, claimed_type)
            temp_path.unlink(missing_ok=True)
        else:
            destination = _local_path(storage_key)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(temp_path), str(destination))
            storage_uri = f"local://{storage_key}"

        document = Document(
            id=document_id,
            query_id=query.id,
            filename=filename,
            gcs_path=storage_uri,
            content_type=claimed_type,
            size_bytes=total_size,
            sha256=digest.hexdigest(),
            processing_status="uploaded",
        )
        db.add(document)
        _log_document_event(
            db,
            query.id,
            "validate_and_store_document",
            "document_stored",
            details=f"document_hash={hash_for_audit(document.sha256)[:16]}; bytes={total_size}; type={claimed_type}",
        )
        db.commit()
        db.refresh(document)
        return {
            "id": document.id,
            "filename": document.filename,
            "content_type": document.content_type,
            "size_bytes": document.size_bytes,
            "processing_status": document.processing_status,
            "created_at": document.created_at.isoformat(),
        }
    except HTTPException:
        temp_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not store the document. Please try again.") from exc
    finally:
        await file.close()


@router.post("/{document_id}/analyze")
def analyze_document(
    document_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(request, max_requests=8, window=60, bucket="document-analysis")
    document = (
        db.query(Document)
        .join(Query, Query.id == Document.query_id)
        .filter(Document.id == document_id, Query.user_id == user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    query = db.query(Query).filter(Query.id == document.query_id).first()
    document.processing_status = "processing"
    db.commit()

    try:
        extracted = _extract_text(document, _read_document_bytes(document))
        if document_agent.execution_mode != "gemini":
            summary = (
                "The document was stored and text was extracted, but live Gemini document analysis is not configured "
                "for this deployment. No AI findings have been generated."
            )
            decision = "analysis_requires_gemini"
            event_status = "unavailable"
        else:
            started = time.monotonic()
            summary = document_agent.analyze_document(document.filename, query.domain if query else "general", extracted)
            duration = int((time.monotonic() - started) * 1000)
            decision = "document_analysis_available"
            event_status = "completed"
        document.analysis_summary = summary[:10_000]
        document.processing_status = event_status
        document.analyzed_at = datetime.now(timezone.utc)
        _log_document_event(
            db,
            document.query_id,
            "analyze_document",
            decision,
            execution_status=event_status,
            details=f"document_hash={hash_for_audit(document.sha256 or '')[:16]}; extracted_chars={len(extracted)}",
        )
        db.commit()
        return {
            "id": document.id,
            "processing_status": document.processing_status,
            "analysis_summary": document.analysis_summary,
            "analyzed_at": document.analyzed_at.isoformat(),
        }
    except HTTPException:
        document.processing_status = "failed"
        db.commit()
        raise
    except AgentExecutionError:
        document.processing_status = "failed"
        _log_document_event(db, document.query_id, "analyze_document", "ai_service_unavailable", execution_status="failed")
        db.commit()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The AI service is temporarily unavailable")
    except Exception as exc:
        document.processing_status = "failed"
        _log_document_event(db, document.query_id, "analyze_document", "analysis_failed", execution_status="failed")
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document analysis could not be completed") from exc
