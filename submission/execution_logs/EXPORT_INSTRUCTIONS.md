# Agent Execution Logs Export

This file should contain the JSON export of the `agent_execution_logs` table from your production database for the last 30 days.

## How to Generate

### Option 1: SQL Query (PostgreSQL)
```sql
SELECT 
    id,
    query_id,
    agent_name,
    action,
    input_data,
    output_data,
    decision,
    confidence_score,
    execution_time_ms,
    status,
    created_at
FROM agent_execution_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

### Option 2: Python Script
```python
import json
from datetime import datetime, timedelta
from database import SessionLocal
from models import AgentExecutionLog

db = SessionLocal()
try:
    cutoff = datetime.utcnow() - timedelta(days=30)
    logs = db.query(AgentExecutionLog).filter(
        AgentExecutionLog.created_at >= cutoff
    ).order_by(AgentExecutionLog.created_at.desc()).all()
    
    data = [{
        "id": log.id,
        "query_id": log.query_id,
        "agent_name": log.agent_name,
        "action": log.action,
        "input_data": log.input_data,
        "output_data": log.output_data,
        "decision": log.decision,
        "confidence_score": log.confidence_score,
        "execution_time_ms": log.execution_time_ms,
        "status": log.status,
        "created_at": log.created_at.isoformat()
    } for log in logs]
    
    with open("execution_logs_export.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"Exported {len(data)} execution logs")
finally:
    db.close()
```

### Option 3: API Endpoint (if you build one)
```
GET /analytics/agent-execution-logs?days=30
```

## Expected Schema

```json
[
  {
    "id": "uuid",
    "query_id": "uuid",
    "agent_name": "TriageAgent|LegalAgent|FinancialAgent|MedicalAgent|EscalationAgent|FollowUpAgent|SafetyBoundary|BusinessIntelligenceAgent|HumanProfessional",
    "action": "classify_and_route|generate_information_response|create_professional_referral|recommend_next_steps|untrusted_input_guard|handle_agent_failure|resolve_escalation|analyze_business_metrics",
    "input_data": "content_hash=abc123; chars=245",
    "output_data": "mode=gemini-1.5-flash; requested_domain=legal",
    "decision": "route_legal|response_available|human_review_required|next_steps_generated|input_treated_as_data|safe_failure|professional_response_recorded",
    "confidence_score": 0.85,
    "execution_time_ms": 1240,
    "status": "completed|guarded|failed",
    "created_at": "2026-08-10T14:32:11.123Z"
  }
]
```

## Verification Checklist

- [ ] Export covers full 30-day hackathon period
- [ ] Contains ALL agent types (Triage, Specialist, Escalation, FollowUp, Safety, HumanProfessional)
- [ ] No sensitive user content in input_data/output_data (only hashes/previews)
- [ ] Status distribution shows real production mix (completed, guarded, failed)
- [ ] Execution times are realistic (not all 0 or identical)

---

**Save the actual export as:** `execution_logs/execution_logs_export.json`