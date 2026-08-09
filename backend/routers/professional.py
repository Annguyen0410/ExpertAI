"""Professional referral queue, secure claims, responses, and feedback."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session

from auth import get_current_user, require_role
from database import get_db
from models import AgentExecutionLog, Escalation, Feedback, Query, QueryStatus, User, UserRole
from security import check_rate_limit, sanitize_input


router = APIRouter(prefix="/professional", tags=["professional"])


class EscalationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    professional_response: str
    resolution_notes: str | None = None

    @field_validator("professional_response")
    @classmethod
    def validate_professional_response(cls, value: str) -> str:
        value = sanitize_input(value, max_length=10_000)
        if not value:
            raise ValueError("Response is required")
        return value

    @field_validator("resolution_notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return sanitize_input(value, max_length=5_000) if value else None


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rating: int
    comment: str | None = None
    is_testimonial: bool = False
    testimonial_text: str | None = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, value: int) -> int:
        if value < 1 or value > 5:
            raise ValueError("Rating must be between 1 and 5")
        return value

    @field_validator("comment", "testimonial_text")
    @classmethod
    def sanitize_optional_text(cls, value: str | None) -> str | None:
        return sanitize_input(value, max_length=2_000) if value else None


def _require_professional(user: User) -> None:
    if user.role not in (UserRole.professional, UserRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Professional access is required")


def _escalation_payload(escalation: Escalation, *, include_case: bool = False) -> dict:
    query = escalation.query
    payload = {
        "id": escalation.id,
        "query_id": escalation.query_id,
        "query_title": query.title if query else "Untitled case",
        "domain": query.domain if query else "general",
        "reason": escalation.reason,
        "status": escalation.status,
        "created_at": escalation.created_at.isoformat(),
        "resolved_at": escalation.resolved_at.isoformat() if escalation.resolved_at else None,
    }
    if include_case:
        payload.update(
            {
                "query_content": query.content if query else "",
                "case_summary": escalation.case_summary,
                "professional_response": escalation.professional_response,
            }
        )
    return payload


@router.get("/escalations")
def get_escalations(
    user: User = Depends(require_role([UserRole.professional, UserRole.admin])),
    db: Session = Depends(get_db),
):
    escalations = (
        db.query(Escalation)
        .filter(Escalation.professional_id == user.id)
        .order_by(Escalation.created_at.desc())
        .all()
    )
    return [_escalation_payload(escalation, include_case=True) for escalation in escalations]


@router.get("/escalations/open")
def get_open_escalations(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_rate_limit(request, max_requests=30, window=60, bucket="professional-queue")
    _require_professional(user)
    escalations = (
        db.query(Escalation)
        .filter(Escalation.professional_id == user.id, Escalation.status.in_(("pending", "claimed")))
        .order_by(Escalation.created_at.asc())
        .all()
    )
    return [_escalation_payload(escalation, include_case=True) for escalation in escalations]


@router.get("/escalations/stats")
def get_escalation_stats(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_rate_limit(request, max_requests=30, window=60, bucket="professional-stats")
    _require_professional(user)
    base = db.query(Escalation).filter(Escalation.professional_id == user.id)
    return {
        "total": base.count(),
        "pending": base.filter(Escalation.status.in_(("pending", "claimed"))).count(),
        "resolved": base.filter(Escalation.status == "resolved").count(),
    }


@router.get("/escalations/available")
def get_available_escalations(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_rate_limit(request, max_requests=30, window=60, bucket="available-referrals")
    _require_professional(user)
    escalations = (
        db.query(Escalation)
        .filter(Escalation.professional_id.is_(None), Escalation.status == "pending")
        .order_by(Escalation.created_at.asc())
        .limit(20)
        .all()
    )
    # Before accepting the referral, professionals see only minimal routing
    # data—not the user's raw question or case brief.
    return [_escalation_payload(escalation, include_case=False) for escalation in escalations]


@router.post("/escalations/{escalation_id}/claim")
def claim_escalation(
    escalation_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(request, max_requests=20, window=60, bucket="claim-referral")
    _require_professional(user)
    # Conditional update closes the check-then-claim race between multiple
    # professionals without exposing a referral to the wrong account.
    claimed = (
        db.query(Escalation)
        .filter(
            Escalation.id == escalation_id,
            Escalation.professional_id.is_(None),
            Escalation.status == "pending",
        )
        .update({Escalation.professional_id: user.id, Escalation.status: "claimed"}, synchronize_session=False)
    )
    if not claimed:
        escalation = db.query(Escalation).filter(Escalation.id == escalation_id).first()
        if not escalation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")
        if escalation.professional_id == user.id:
            return {"status": "claimed", "escalation_id": escalation_id}
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Referral is no longer available")
    db.commit()
    return {"status": "claimed", "escalation_id": escalation_id}


@router.post("/escalations/{escalation_id}/respond")
def respond_to_escalation(
    escalation_id: str,
    req: EscalationResponse,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(request, max_requests=20, window=60, bucket="professional-response")
    _require_professional(user)
    escalation = db.query(Escalation).filter(Escalation.id == escalation_id).first()
    if not escalation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")
    if escalation.professional_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this referral")
    if escalation.status == "resolved":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Referral is already resolved")

    escalation.professional_response = req.professional_response
    escalation.status = "resolved"
    escalation.resolved_at = datetime.now(timezone.utc)
    query = db.query(Query).filter(Query.id == escalation.query_id).first()
    if query:
        query.status = QueryStatus.closed
        query.resolved_by = user.name or user.email
        query.resolution_notes = req.resolution_notes
        db.add(
            AgentExecutionLog(
                query_id=query.id,
                agent_name="HumanProfessional",
                action="resolve_escalation",
                decision="professional_response_recorded",
                status="completed",
                output_data=f"response_chars={len(req.professional_response)}",
            )
        )
    db.commit()
    return {"status": "resolved", "escalation_id": escalation_id}


@router.post("/feedback")
def submit_feedback_without_query():
    # The old route wrote an invalid empty foreign key. Feedback must remain
    # scoped to a user-owned query for auditability and consent handling.
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Submit feedback from a specific query instead.",
    )


@router.post("/queries/{query_id}/feedback")
def submit_query_feedback(
    query_id: str,
    req: FeedbackRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(request, max_requests=10, window=60, bucket="query-feedback")
    query = db.query(Query).filter(Query.id == query_id, Query.user_id == user.id).first()
    if not query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")
    approved_testimonial = bool(req.is_testimonial and req.testimonial_text)
    feedback = Feedback(
        query_id=query_id,
        user_id=user.id,
        rating=req.rating,
        comment=req.comment,
        is_testimonial=approved_testimonial,
        testimonial_text=req.testimonial_text if approved_testimonial else None,
    )
    query.feedback_score = req.rating
    db.add(feedback)
    db.commit()
    return {"status": "submitted", "testimonial_accepted": approved_testimonial}
