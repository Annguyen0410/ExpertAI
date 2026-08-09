"""Authenticated AI orchestration, conversations, and execution traces."""

from __future__ import annotations

import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session

from agents.base import AgentExecutionError
from agents.financial import FinancialAgent
from agents.legal import LegalAgent
from agents.medical import MedicalAgent
from agents.operations import CustomerSupportAgent, EscalationAgent, FollowUpAgent
from agents.triage import TriageAgent
from auth import get_current_user
from database import get_db
from models import (
    AgentExecutionLog,
    Document,
    Escalation,
    Message,
    Query,
    QueryStatus,
    SubscriptionTier,
    User,
)
from security import check_rate_limit, hash_for_audit, sanitize_input


router = APIRouter(prefix="/agents", tags=["agents"])

AGENTS = {
    "legal": LegalAgent(),
    "financial": FinancialAgent(),
    "medical": MedicalAgent(),
    "general": CustomerSupportAgent(),
}
triage_agent = TriageAgent()
escalation_agent = EscalationAgent()
follow_up_agent = FollowUpAgent()


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: Literal["legal", "financial", "medical"] | None = None
    content: str
    title: str | None = None

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        value = sanitize_input(value, max_length=10_000)
        if not value:
            raise ValueError("Content cannot be empty")
        return value

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = sanitize_input(value, max_length=200)
        return value or None


class MessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        value = sanitize_input(value, max_length=6_000)
        if not value:
            raise ValueError("Content cannot be empty")
        return value


def _content_fingerprint(content: str) -> str:
    return f"content_hash={hash_for_audit(content)[:16]}; chars={len(content)}"


def log_execution(
    db: Session,
    query_id: str,
    *,
    agent_name: str,
    action: str,
    decision: str,
    confidence: float | None = None,
    exec_ms: int | None = None,
    execution_status: str = "completed",
    input_data: str | None = None,
    output_data: str | None = None,
) -> AgentExecutionLog:
    """Create an audit row without duplicating sensitive conversation content."""
    entry = AgentExecutionLog(
        query_id=query_id,
        agent_name=agent_name[:100],
        action=action[:100],
        input_data=(input_data or "")[:500] or None,
        output_data=(output_data or "")[:500] or None,
        decision=decision[:500],
        confidence_score=confidence,
        execution_time_ms=exec_ms,
        status=execution_status[:32],
    )
    db.add(entry)
    return entry


def _trace_payload(log: AgentExecutionLog) -> dict[str, Any]:
    return {
        "agent_name": log.agent_name,
        "action": log.action,
        "decision": log.decision,
        "status": log.status,
        "confidence_score": log.confidence_score,
        "execution_time_ms": log.execution_time_ms,
        "created_at": log.created_at.isoformat(),
    }


def _human_escalation_response(domain: str, reason: str) -> str:
    if domain == "medical" and "emergency" in reason.lower():
        return (
            "This may need urgent medical attention. If you are experiencing an emergency or immediate danger, "
            "call your local emergency number now. I’ve marked this for qualified human follow-up rather than "
            "trying to assess it here."
        )
    return (
        "This request needs qualified professional review before it would be responsible to provide a tailored "
        "answer. I’ve prepared a private intake brief and marked the case for escalation."
    )


def _create_escalation(
    db: Session,
    query: Query,
    content: str,
    domain: str,
    reason: str,
) -> Escalation:
    existing = (
        db.query(Escalation)
        .filter(Escalation.query_id == query.id, Escalation.status.in_(("pending", "claimed")))
        .first()
    )
    if existing:
        return existing
    summary = escalation_agent.prepare_case_summary(content, domain, reason)
    escalation = Escalation(
        query_id=query.id,
        reason=reason[:500] or "Professional review requested",
        case_summary=summary,
        status="pending",
    )
    db.add(escalation)
    return escalation


def _usage_allowed(user: User, db: Session) -> bool:
    if user.subscription_tier != SubscriptionTier.free or user.subscription_active:
        return True
    return db.query(Query).filter(Query.user_id == user.id).count() < 3


@router.post("/query")
def submit_query(
    req: QueryRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(request, max_requests=10, window=60, bucket="new-query")
    if not _usage_allowed(user, db):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Your free plan includes three queries. Upgrade to continue.",
        )

    safe_content = req.content
    triage_started = time.monotonic()
    triage = triage_agent.analyze(safe_content)
    triage_ms = int((time.monotonic() - triage_started) * 1000)
    triage_domain = triage.get("domain", "general")
    # A user can express a preference, but it must never bypass safety routing.
    domain = triage_domain if triage_domain != "general" else (req.domain or "general")
    if domain not in AGENTS:
        domain = "general"
    complexity = float(triage.get("complexity_score", 0.5))
    needs_escalation = bool(triage.get("needs_escalation", False))
    escalation_reason = str(triage.get("escalation_reason", ""))[:500]

    query = Query(
        user_id=user.id,
        domain=domain,
        title=req.title or safe_content[:80],
        content=safe_content,
        status=QueryStatus.processing,
        complexity_score=complexity,
        is_escalated=needs_escalation,
        escalation_reason=escalation_reason or None,
    )
    db.add(query)
    db.flush()
    db.add(Message(query_id=query.id, role="user", content=safe_content))
    log_execution(
        db,
        query.id,
        agent_name="TriageAgent",
        action="classify_and_route",
        decision=(f"escalate_{domain}" if needs_escalation else f"route_{domain}"),
        confidence=max(0.0, min(1.0, 1.0 - complexity)),
        exec_ms=triage_ms,
        execution_status="guarded" if triage.get("input_safety_flags") else "completed",
        input_data=_content_fingerprint(safe_content),
        output_data=f"mode={triage.get('mode', 'unknown')}; requested_domain={req.domain or 'auto'}",
    )
    if triage.get("input_safety_flags"):
        log_execution(
            db,
            query.id,
            agent_name="SafetyBoundary",
            action="untrusted_input_guard",
            decision="input_treated_as_data",
            execution_status="guarded",
            input_data=_content_fingerprint(safe_content),
        )
    db.commit()
    db.refresh(query)

    if needs_escalation:
        response_text = _human_escalation_response(domain, escalation_reason)
        _create_escalation(db, query, safe_content, domain, escalation_reason)
        query.status = QueryStatus.escalated
        query.agent_response = response_text
        db.add(Message(query_id=query.id, role="assistant", content=response_text))
        log_execution(
            db,
            query.id,
            agent_name="EscalationAgent",
            action="create_professional_referral",
            decision="human_review_required",
            confidence=complexity,
            execution_status="completed",
            input_data=_content_fingerprint(safe_content),
            output_data="intake_brief_created",
        )
        db.commit()
        return {
            "query_id": query.id,
            "domain": domain,
            "status": query.status.value,
            "is_escalated": True,
            "escalation_reason": escalation_reason,
            "response": response_text,
            "complexity_score": complexity,
            "execution_mode": triage.get("mode"),
            "next_steps": ["A qualified professional can review the case intake when available."],
        }

    agent = AGENTS[domain]
    try:
        started = time.monotonic()
        if domain == "general":
            response_text = (
                "I can help route legal, financial, or medical information requests. Please share which area "
                "your question relates to and the general outcome you are trying to understand."
            )
        else:
            response_text = agent.advise(safe_content)
        execution_ms = int((time.monotonic() - started) * 1000)
        query.status = QueryStatus.completed
        query.agent_response = response_text
        db.add(Message(query_id=query.id, role="assistant", content=response_text))
        log_execution(
            db,
            query.id,
            agent_name=f"{domain.capitalize()}Agent" if domain != "general" else "RoutingAssistant",
            action="generate_information_response",
            decision="response_available",
            confidence=max(0.0, min(1.0, 1.0 - complexity)),
            exec_ms=execution_ms,
            execution_status="completed",
            input_data=_content_fingerprint(safe_content),
            output_data=f"response_chars={len(response_text)}; mode={getattr(agent, 'execution_mode', 'local')}",
        )
        follow_up = follow_up_agent.recommend(domain, response_text)
        log_execution(
            db,
            query.id,
            agent_name="FollowUpAgent",
            action="recommend_next_steps",
            decision="next_steps_generated",
            execution_status="completed",
            output_data=f"steps={len(follow_up['next_steps'])}; missing={len(follow_up['missing_information'])}",
        )
    except AgentExecutionError:
        query.status = QueryStatus.failed
        response_text = "The AI service is temporarily unavailable. Your request was saved; please try again shortly."
        follow_up = {"next_steps": ["Try again later or ask a qualified professional."], "missing_information": []}
        db.add(Message(query_id=query.id, role="assistant", content=response_text))
        log_execution(
            db,
            query.id,
            agent_name=f"{domain.capitalize()}Agent",
            action="generate_information_response",
            decision="service_unavailable",
            execution_status="failed",
            input_data=_content_fingerprint(safe_content),
        )
    except Exception:
        query.status = QueryStatus.failed
        response_text = "We could not process that request safely. Please try again or contact support."
        follow_up = {"next_steps": [], "missing_information": []}
        db.add(Message(query_id=query.id, role="assistant", content=response_text))
        log_execution(
            db,
            query.id,
            agent_name="Orchestrator",
            action="handle_agent_failure",
            decision="safe_failure",
            execution_status="failed",
            input_data=_content_fingerprint(safe_content),
        )
    db.commit()
    db.refresh(query)

    return {
        "query_id": query.id,
        "domain": domain,
        "status": query.status.value,
        "is_escalated": query.is_escalated,
        "escalation_reason": query.escalation_reason,
        "response": response_text,
        "complexity_score": query.complexity_score,
        "execution_mode": triage.get("mode"),
        "next_steps": follow_up["next_steps"],
        "missing_information": follow_up["missing_information"],
    }


@router.get("/queries")
def list_queries(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    queries = (
        db.query(Query)
        .filter(Query.user_id == user.id)
        .order_by(Query.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": query.id,
            "domain": query.domain,
            "title": query.title,
            "status": query.status.value,
            "is_escalated": query.is_escalated,
            "complexity_score": query.complexity_score,
            "feedback_score": query.feedback_score,
            "created_at": query.created_at.isoformat(),
        }
        for query in queries
    ]


@router.get("/queries/{query_id}")
def get_query(query_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Query).filter(Query.id == query_id, Query.user_id == user.id).first()
    if not query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")
    messages = db.query(Message).filter(Message.query_id == query.id).order_by(Message.created_at).all()
    logs = db.query(AgentExecutionLog).filter(AgentExecutionLog.query_id == query.id).order_by(AgentExecutionLog.created_at).all()
    documents = db.query(Document).filter(Document.query_id == query.id).order_by(Document.created_at.desc()).all()
    return {
        "id": query.id,
        "domain": query.domain,
        "title": query.title,
        "content": query.content,
        "status": query.status.value,
        "is_escalated": query.is_escalated,
        "escalation_reason": query.escalation_reason,
        "complexity_score": query.complexity_score,
        "agent_response": query.agent_response,
        "feedback_score": query.feedback_score,
        "resolved_by": query.resolved_by,
        "messages": [{"role": message.role, "content": message.content, "created_at": message.created_at.isoformat()} for message in messages],
        "execution_logs": [_trace_payload(log) for log in logs],
        "documents": [
            {
                "id": document.id,
                "filename": document.filename,
                "content_type": document.content_type,
                "size_bytes": document.size_bytes,
                "processing_status": document.processing_status,
                "analysis_summary": document.analysis_summary,
                "created_at": document.created_at.isoformat(),
                "analyzed_at": document.analyzed_at.isoformat() if document.analyzed_at else None,
            }
            for document in documents
        ],
        "created_at": query.created_at.isoformat(),
    }


@router.post("/queries/{query_id}/chat")
def chat_query(
    query_id: str,
    req: MessageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(request, max_requests=20, window=60, bucket="query-chat")
    query = db.query(Query).filter(Query.id == query_id, Query.user_id == user.id).first()
    if not query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")

    safe_content = req.content
    db.add(Message(query_id=query_id, role="user", content=safe_content))
    db.flush()
    triage = triage_agent.analyze(safe_content)
    if triage.get("needs_escalation"):
        reason = str(triage.get("escalation_reason", "Professional review is required"))[:500]
        _create_escalation(db, query, safe_content, query.domain, reason)
        query.is_escalated = True
        query.escalation_reason = reason
        query.status = QueryStatus.escalated
        response_text = _human_escalation_response(query.domain, reason)
        query.agent_response = response_text
        db.add(Message(query_id=query_id, role="assistant", content=response_text))
        log_execution(
            db,
            query_id,
            agent_name="TriageAgent",
            action="follow_up_risk_check",
            decision="human_review_required",
            confidence=float(triage.get("complexity_score", 0.85)),
            execution_status="completed",
            input_data=_content_fingerprint(safe_content),
        )
        db.commit()
        return {"role": "assistant", "content": response_text, "is_escalated": True}

    messages = (
        db.query(Message)
        .filter(Message.query_id == query_id)
        .order_by(Message.created_at.desc())
        .limit(12)
        .all()
    )
    history = [
        {"role": "model" if message.role == "assistant" else "user", "parts": [message.content]}
        for message in reversed(messages[:-1])
        if message.role in {"assistant", "user"}
    ]
    agent = AGENTS.get(query.domain, AGENTS["general"])
    try:
        started = time.monotonic()
        response_text = agent.advise(safe_content, history) if query.domain in {"legal", "financial", "medical"} else agent.assist(safe_content)
        execution_ms = int((time.monotonic() - started) * 1000)
        query.agent_response = response_text
        if query.status == QueryStatus.failed:
            query.status = QueryStatus.completed
        db.add(Message(query_id=query_id, role="assistant", content=response_text))
        log_execution(
            db,
            query_id,
            agent_name=f"{query.domain.capitalize()}Agent",
            action="continue_conversation",
            decision="response_available",
            confidence=0.7,
            exec_ms=execution_ms,
            input_data=_content_fingerprint(safe_content),
            output_data=f"response_chars={len(response_text)}",
        )
    except AgentExecutionError:
        response_text = "The AI service is temporarily unavailable. Please try again shortly."
        db.add(Message(query_id=query_id, role="assistant", content=response_text))
        log_execution(
            db,
            query_id,
            agent_name=f"{query.domain.capitalize()}Agent",
            action="continue_conversation",
            decision="service_unavailable",
            execution_status="failed",
            input_data=_content_fingerprint(safe_content),
        )
    db.commit()
    return {"role": "assistant", "content": response_text, "is_escalated": query.is_escalated}
