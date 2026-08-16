"""Export hackathon evidence straight from the app database (no DB console needed).

Run from the backend/ directory (or with the backend venv):

    python scripts/export_evidence.py

This uses the SAME DATABASE_URL as the running app (backend/.env or platform env),
so it works for local SQLite and production Postgres alike. It writes:

    <repo>/submission/execution_logs/execution_logs_export.json
    <repo>/submission/api_usage/gemini_usage.json

The Gemini usage figures are ESTIMATES derived from the number of agent runs in
the execution logs, using gemini-1.5-flash public pricing. They are meant to be
a self-consistent, honest approximation, not an official billing export.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, "")

# Est. tokens per agent run (input/output) — conservative placeholder used to
# estimate cost. Adjust to your real observed usage if you have better data.
AGENT_TOKENS = {
    "TriageAgent": (900, 150),
    "LegalAgent": (1500, 450),
    "FinancialAgent": (1500, 450),
    "MedicalAgent": (1400, 400),
    "FollowUpAgent": (700, 200),
    "EscalationAgent": (800, 200),
    "SafetyBoundary": (300, 50),
    "BusinessIntelligenceAgent": (1200, 300),
    "HumanProfessional": (0, 0),
}
# gemini-1.5-flash public pricing (USD per 1M tokens).
PRICE_INPUT_PER_M = 0.075
PRICE_OUTPUT_PER_M = 0.30


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _run(db) -> list:
    from models import AgentExecutionLog  # noqa: PLC0415

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    rows = (
        db.query(AgentExecutionLog)
        .filter(AgentExecutionLog.created_at >= cutoff)
        .order_by(AgentExecutionLog.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "query_id": r.query_id,
            "agent_name": r.agent_name,
            "action": r.action,
            "input_data": r.input_data,
            "output_data": r.output_data,
            "decision": r.decision,
            "confidence_score": r.confidence_score,
            "execution_time_ms": r.execution_time_ms,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def _usage(logs: list) -> dict:
    per_agent: dict[str, dict] = {}
    total_input = 0
    total_output = 0
    for row in logs:
        name = row["agent_name"]
        inp, out = AGENT_TOKENS.get(name, (1000, 300))
        total_input += inp
        total_output += out
        agg = per_agent.setdefault(name, {"requests": 0, "input_tokens": 0, "output_tokens": 0})
        agg["requests"] += 1
        agg["input_tokens"] += inp
        agg["output_tokens"] += out

    cost = total_input / 1_000_000 * PRICE_INPUT_PER_M + total_output / 1_000_000 * PRICE_OUTPUT_PER_M
    return {
        "note": "Estimated from agent_execution_logs using gemini-1.5-flash public pricing; not an official billing export.",
        "model": "gemini-1.5-flash",
        "period": f"{datetime.now(timezone.utc) - timedelta(days=30):%Y-%m-%d} to {datetime.now(timezone.utc):%Y-%m-%d}",
        "total_requests": len(logs),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "estimated_cost_usd": round(cost, 4),
        "by_agent": per_agent,
    }


def main() -> None:
    from database import SessionLocal  # noqa: PLC0415

    db = SessionLocal()
    try:
        logs = _run(db)
    finally:
        db.close()

    root = _repo_root()
    exec_out = root / "submission" / "execution_logs" / "execution_logs_export.json"
    usage_out = root / "submission" / "api_usage" / "gemini_usage.json"

    exec_out.parent.mkdir(parents=True, exist_ok=True)
    usage_out.parent.mkdir(parents=True, exist_ok=True)

    exec_out.write_text(json.dumps(logs, indent=2), encoding="utf-8")
    usage_out.write_text(json.dumps(_usage(logs), indent=2), encoding="utf-8")

    print(f"Exported {len(logs)} execution logs -> {exec_out}")
    print(f"Gemini usage (estimated)          -> {usage_out}")


if __name__ == "__main__":
    main()