"""Database entities for ExpertAI.

The schema intentionally keeps the AI audit trail separate from user-facing
conversation content.  Audit records contain safe summaries rather than raw
prompts or documents whenever possible.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    individual = "individual"
    professional = "professional"
    admin = "admin"


class SubscriptionTier(str, enum.Enum):
    free = "free"
    b2c = "b2c"
    b2b = "b2b"


class QueryStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    escalated = "escalated"
    closed = "closed"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(254), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String(100), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.individual, nullable=False)
    stripe_customer_id = Column(String, nullable=True, index=True)
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.free, nullable=False)
    subscription_active = Column(Boolean, default=False, nullable=False)
    professional_title = Column(String(160), nullable=True)
    professional_license = Column(String(160), nullable=True)
    token_version = Column(Integer, default=1, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    queries = relationship("Query", back_populates="user", cascade="all, delete-orphan")
    escalations = relationship("Escalation", back_populates="professional", foreign_keys="Escalation.professional_id")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class Query(Base):
    __tablename__ = "queries"
    __table_args__ = (Index("ix_queries_user_created", "user_id", "created_at"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    domain = Column(String(32), nullable=False, index=True)
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    status = Column(Enum(QueryStatus), default=QueryStatus.pending, nullable=False, index=True)
    complexity_score = Column(Float, nullable=True)
    is_escalated = Column(Boolean, default=False, nullable=False, index=True)
    agent_response = Column(Text, nullable=True)
    escalation_reason = Column(String(500), nullable=True)
    resolved_by = Column(String(200), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    feedback_score = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="queries")
    messages = relationship("Message", back_populates="query", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="query", cascade="all, delete-orphan")
    execution_logs = relationship("AgentExecutionLog", back_populates="query", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_query_created", "query_id", "created_at"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    query_id = Column(String, ForeignKey("queries.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(24), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    query = relationship("Query", back_populates="messages")


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_query_created", "query_id", "created_at"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    query_id = Column(String, ForeignKey("queries.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    # Kept for compatibility with the initial schema. Values are storage URIs,
    # e.g. local://... or gs://..., never client-supplied filesystem paths.
    gcs_path = Column(String, nullable=True)
    content_type = Column(String(128), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    sha256 = Column(String(64), nullable=True, index=True)
    processing_status = Column(String(32), default="uploaded", nullable=False)
    analysis_summary = Column(Text, nullable=True)
    analyzed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    query = relationship("Query", back_populates="documents")


class Escalation(Base):
    __tablename__ = "escalations"
    __table_args__ = (Index("ix_escalations_assignment_status", "professional_id", "status"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    query_id = Column(String, ForeignKey("queries.id", ondelete="CASCADE"), nullable=False, index=True)
    professional_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    reason = Column(String(500), nullable=False)
    case_summary = Column(Text, nullable=True)
    professional_response = Column(Text, nullable=True)
    status = Column(String(32), default="pending", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    query = relationship("Query")
    professional = relationship("User", back_populates="escalations", foreign_keys=[professional_id])


class AgentExecutionLog(Base):
    __tablename__ = "agent_execution_logs"
    __table_args__ = (Index("ix_execution_logs_query_created", "query_id", "created_at"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    query_id = Column(String, ForeignKey("queries.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_name = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    # These legacy columns are retained for existing databases, but callers
    # must only store a redacted preview or digest—not full sensitive content.
    input_data = Column(Text, nullable=True)
    output_data = Column(Text, nullable=True)
    decision = Column(String(500), nullable=True)
    confidence_score = Column(Float, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    status = Column(String(32), default="completed", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    query = relationship("Query", back_populates="execution_logs")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_tokens_user_active", "user_id", "revoked_at"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    replaced_by_hash = Column(String(64), nullable=True)

    user = relationship("User", back_populates="refresh_tokens")


class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (Index("ix_feedback_query_created", "query_id", "created_at"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    query_id = Column(String, ForeignKey("queries.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    # Publishing a quote must remain opt-in and require non-empty text in the
    # router; ratings alone are never treated as a testimonial.
    is_testimonial = Column(Boolean, default=False, nullable=False)
    testimonial_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class RevenueEvent(Base):
    __tablename__ = "revenue_events"
    __table_args__ = (Index("ix_revenue_events_created", "created_at"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String(100), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    description = Column(String(500), nullable=True)
    stripe_event_id = Column(String, nullable=True, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class SecurityEvent(Base):
    __tablename__ = "security_events"
    __table_args__ = (Index("ix_security_events_user_created", "user_id", "created_at"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type = Column(String(100), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # IP values must be keyed/hashed before persistence by callers.
    ip_address = Column(String(128), nullable=True)
    user_agent = Column(String(500), nullable=True)
    details = Column(Text, nullable=True)
    severity = Column(String(32), default="info", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
