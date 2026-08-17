"""Admin-only aggregate analytics and bounded operational insights."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query as QueryParam
from sqlalchemy import func
from sqlalchemy.orm import Session

from agents.base import AgentExecutionError
from agents.operations import BusinessIntelligenceAgent
from auth import require_role
from config import B2B_PRICE, B2C_PRICE
from database import get_db
from models import AgentExecutionLog, Feedback, Query, RevenueEvent, SubscriptionTier, User, UserRole


router = APIRouter(prefix="/analytics", tags=["analytics"])
bi_agent = BusinessIntelligenceAgent()


def _overview(db: Session) -> dict:
    # Batch the per-status counts into a single GROUP BY instead of one COUNT
    # per status. Queries marked escalated never transition to "completed" (the
    # router sets "escalated"/"closed" instead), so completed queries are by
    # definition AI-resolved without a human.
    status_rows = db.query(Query.status, func.count(Query.id)).group_by(Query.status).all()
    status_counts = {status: count for status, count in status_rows}
    total_queries = sum(status_counts.values())
    total_completed = status_counts.get("completed", 0)
    total_escalations = db.query(Query).filter(Query.is_escalated.is_(True)).count()
    total_users = db.query(User).count()
    paid_users = db.query(User).filter(User.subscription_active.is_(True)).count()
    revenue_total = db.query(func.sum(RevenueEvent.amount_cents)).scalar() or 0
    feedback_avg = db.query(func.avg(Feedback.rating)).scalar()
    by_domain = db.query(Query.domain, func.count(Query.id)).group_by(Query.domain).all()
    return {
        "total_queries": total_queries,
        "total_users": total_users,
        "paid_users": paid_users,
        "ai_resolution_rate": round((total_completed / total_queries * 100), 1) if total_queries else None,
        "total_escalations": total_escalations,
        "revenue_cents": revenue_total,
        "revenue_dollars": round(revenue_total / 100, 2),
        "avg_feedback_rating": round(feedback_avg, 1) if feedback_avg is not None else None,
        "queries_by_domain": {domain: count for domain, count in by_domain},
    }


@router.get("/overview")
def get_overview(
    _user: User = Depends(require_role([UserRole.admin])),
    db: Session = Depends(get_db),
):
    return _overview(db)


@router.get("/agent-logs")
def get_agent_logs(
    limit: int = QueryParam(default=50, ge=1, le=100),
    _user: User = Depends(require_role([UserRole.admin])),
    db: Session = Depends(get_db),
):
    logs = db.query(AgentExecutionLog).order_by(AgentExecutionLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "query_id": log.query_id,
            "agent_name": log.agent_name,
            "action": log.action,
            "decision": log.decision,
            "status": log.status,
            "confidence_score": log.confidence_score,
            "execution_time_ms": log.execution_time_ms,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/agent-executions")
def get_agent_executions(
    period: Literal["24h", "7d", "30d", "90d"] = "7d",
    _user: User = Depends(require_role([UserRole.admin])),
    db: Session = Depends(get_db),
):
    days = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}
    since = datetime.now(timezone.utc) - timedelta(days=days[period])
    by_agent = (
        db.query(AgentExecutionLog.agent_name, func.count(AgentExecutionLog.id))
        .filter(AgentExecutionLog.created_at >= since)
        .group_by(AgentExecutionLog.agent_name)
        .all()
    )
    by_action = (
        db.query(AgentExecutionLog.action, func.count(AgentExecutionLog.id))
        .filter(AgentExecutionLog.created_at >= since)
        .group_by(AgentExecutionLog.action)
        .all()
    )
    return {
        "period": period,
        "total_executions": sum(count for _, count in by_agent),
        "by_agent": {agent: count for agent, count in by_agent},
        "by_action": {action: count for action, count in by_action},
    }


@router.get("/revenue")
def get_revenue(
    _user: User = Depends(require_role([UserRole.admin])),
    db: Session = Depends(get_db),
):
    events = db.query(RevenueEvent).order_by(RevenueEvent.created_at.desc()).limit(100).all()
    total = db.query(func.sum(RevenueEvent.amount_cents)).scalar() or 0
    counts = db.query(RevenueEvent.event_type, func.count(RevenueEvent.id)).group_by(RevenueEvent.event_type).all()
    active_b2c = db.query(User).filter(User.subscription_tier == SubscriptionTier.b2c, User.subscription_active.is_(True)).count()
    active_b2b = db.query(User).filter(User.subscription_tier == SubscriptionTier.b2b, User.subscription_active.is_(True)).count()
    projected_mrr = active_b2c * B2C_PRICE + active_b2b * B2B_PRICE
    return {
        "total_revenue_cents": total,
        "total_revenue_dollars": round(total / 100, 2),
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
        "by_type": {event_type: count for event_type, count in counts},
        "active_b2c": active_b2c,
        "active_b2b": active_b2b,
        "projected_mrr_cents": projected_mrr,
        "projected_mrr_dollars": round(projected_mrr / 100, 2),
    }


@router.get("/business-insights")
def get_business_insights(
    _user: User = Depends(require_role([UserRole.admin])),
    db: Session = Depends(get_db),
):
    metrics = _overview(db)
    if bi_agent.execution_mode != "gemini":
        return {
            "available": False,
            "reason": "Live Gemini business intelligence is not configured for this deployment.",
            "metrics": metrics,
            "insights": None,
        }
    try:
        return {
            "available": True,
            "metrics": metrics,
            "insights": bi_agent.analyze_metrics(metrics),
        }
    except AgentExecutionError:
        return {
            "available": False,
            "reason": "Gemini business intelligence is temporarily unavailable.",
            "metrics": metrics,
            "insights": None,
        }


@router.get("/testimonials")
def get_testimonials(
    _user: User = Depends(require_role([UserRole.admin])),
    db: Session = Depends(get_db),
):
    # Single joined query: loading the author per row used to run one extra
    # query per testimonial (N+1).
    rows = (
        db.query(Feedback, User)
        .join(User, User.id == Feedback.user_id)
        .filter(Feedback.is_testimonial.is_(True), Feedback.testimonial_text.is_not(None))
        .order_by(Feedback.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": feedback.id,
            "user_name": user.name if user else "Anonymous",
            "rating": feedback.rating,
            "testimonial_text": feedback.testimonial_text,
            "created_at": feedback.created_at.isoformat(),
        }
        for feedback, user in rows
    ]
