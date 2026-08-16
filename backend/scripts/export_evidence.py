"""Export agent execution logs and an estimated Gemini usage report from the
production database as JSON evidence for the hackathon submission.

Usage (run from the backend/ directory), passing the database URL:

    python scripts/export_evidence.py "postgresql://user:pass@host:5432/db"
    # or use the DATABASE_URL env var:
    DATABASE_URL="postgresql://..." python scripts/export_evidence.py

Writes:
    submission/execution_logs/execution_logs_export.json
    submission/api_usage/gemini_usage.json

The database password is only used in-memory for this run; it is never written
to any file.
"""

from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, "")

from sqlalchemy import create_engine, text  # noqa: E402

# Rough per-call cost assumptions for the Gemini flash-class models. Used only to
# estimate cost for the report; actual numbers come from AI Studio / Cloud Billing.
_ASSUMED_COST_PER_CALL_USD = 0.002

_REPO_ROOT = Path(__file__).resolve().parents[2]


def _pick_db_url() -> str:
    if len(sys.argv) > 1 and sys.argv[1].startswith("postgres"):
        return sys.argv[1]
    url = os.getenv("DATABASE_URL", "")
    if not url:
        print(
            "No database URL provided.\n"
            'Usage: python scripts/export_evidence.py "postgresql://user:pass@host/db"'
        )
        sys.exit(2)
    return url


def main() -> None:
    url = _pick_db_url()
    print("Connecting to the database...")

    engine = create_engine(url, pool_pre_ping=True)
    cutoff = datetime.utcnow() - timedelta(days=30)

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, query_id, agent_name, action, input_data, output_data,
                       decision, confidence_score, execution_time_ms, status, created_at
                FROM agent_execution_logs
                WHERE created_at >= :cutoff
                ORDER BY created_at DESC
                """
            ),
            {"cutoff": cutoff},
        ).mappings().all()

    logs = [
        {
            "id": r["id"],
            "query_id": r["query_id"],
            "agent_name": r["agent_name"],
            "action": r["action"],
            "input_data": r["input_data"],
            "output_data": r["output_data"],
            "decision": r["decision"],
            "confidence_score": r["confidence_score"],
            "execution_time_ms": r["execution_time_ms"],
            "status": r["status"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]

    exec_path = _REPO_ROOT / "submission" / "execution_logs" / "execution_logs_export.json"
    exec_path.parent.mkdir(parents=True, exist_ok=True)
    exec_path.write_text(json.dumps(logs, indent=2), encoding="utf-8")
    print(f"Wrote {len(logs)} execution logs -> {exec_path.relative_to(_REPO_ROOT)}")

    # Gemini usage estimate, aggregated per agent.
    by_agent: dict[str, int] = defaultdict(int)
    status_mix: dict[str, int] = defaultdict(int)
    for r in logs:
        by_agent[r["agent_name"]] += 1
        status_mix[r["status"]] += 1

    total_calls = len(logs)
    usage = {
        "period": "last 30 days",
        "model": "gemini-family (flash-class)",
        "total_requests": total_calls,
        "estimated_cost_usd": round(total_calls * _ASSUMED_COST_PER_CALL_USD, 2),
        "by_agent": {
            name: {"requests": count}
            for name, count in sorted(by_agent.items(), key=lambda kv: kv[1], reverse=True)
        },
        "status_distribution": dict(status_mix),
        "note": "Estimated from agent_execution_logs; reference billing for exact cost.",
    }

    usage_path = _REPO_ROOT / "submission" / "api_usage" / "gemini_usage.json"
    usage_path.write_text(json.dumps(usage, indent=2), encoding="utf-8")
    print(f"Wrote Gemini usage estimate -> {usage_path.relative_to(_REPO_ROOT)}")

    print("\nSummary:")
    print(f"  Total agent executions (30d): {total_calls}")
    print(f"  Estimated Gemini cost:       ${usage['estimated_cost_usd']:.2f}")


if __name__ == "__main__":
    main()