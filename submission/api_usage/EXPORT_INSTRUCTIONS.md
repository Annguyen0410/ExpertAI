# API Usage Export Instructions

This folder contains API usage records from production services.

---

## 1. Gemini API Usage (api_usage/gemini_usage.json)

### Source
- **Google AI Studio**: https://aistudio.google.com/apikey (if using API key)
- **Vertex AI Console**: https://console.cloud.google.com/vertex-ai (if using Vertex AI)

### How to Export

#### Option A: Google AI Studio (API Key)
1. Go to https://aistudio.google.com/usage
2. Select date range: Hackathon period (90 days)
3. Export CSV/JSON
4. Save as `gemini_usage.json`

#### Option B: Vertex AI (Cloud Project)
```bash
# Requires gcloud auth and billing export enabled
gcloud logging read \
  'resource.type="vertex_ai_model" AND severity>=DEFAULT' \
  --project=YOUR_PROJECT_ID \
  --format=json \
  --freshness=90d > gemini_usage_raw.json
```

#### Option C: Programmatic (if you track in-app)
Your backend can log each Gemini call. Check `agents/base.py` — the `run_with_json` and `generate` methods. Add usage logging there if not already present.

### Expected Format
```json
{
  "period": "2026-05-15 to 2026-08-15",
  "model": "gemini-1.5-flash",
  "total_requests": 1247,
  "total_input_tokens": 3421000,
  "total_output_tokens": 892000,
  "estimated_cost_usd": 12.47,
  "by_agent": {
    "TriageAgent": {"requests": 450, "input_tokens": 1200000, "output_tokens": 180000},
    "LegalAgent": {"requests": 320, "input_tokens": 980000, "output_tokens": 340000},
    "FinancialAgent": {"requests": 280, "input_tokens": 720000, "output_tokens": 220000},
    "MedicalAgent": {"requests": 197, "input_tokens": 521000, "output_tokens": 152000}
  },
  "daily_breakdown": [
    {"date": "2026-08-10", "requests": 42, "cost_usd": 0.42},
    {"date": "2026-08-11", "requests": 38, "cost_usd": 0.38}
  ]
}
```

---

## 2. Stripe Webhook Logs (api_usage/stripe_webhook_logs.json)

### Source
Stripe Dashboard → Developers → Webhooks → [Your Endpoint] → Delivery attempts

### How to Export

#### Option A: Dashboard (Manual)
1. Go to https://dashboard.stripe.com/webhooks
2. Click your endpoint (e.g., `https://api.yourapp.com/webhooks/stripe`)
3. Filter: Last 90 days, All events
4. Click "Export" → JSON
5. Save as `stripe_webhook_logs.json`

#### Option B: Stripe CLI
```bash
stripe login
stripe events list --limit 1000 --created[gte]=1715731200 --format json > stripe_webhook_logs.json
```
(1715731200 = May 15, 2026 — adjust for your 90-day window)

#### Option C: API (Programmatic)
```python
import stripe
import json
from datetime import datetime, timedelta

stripe.api_key = "sk_live_..."  # Your live secret key

cutoff = int((datetime.now() - timedelta(days=90)).timestamp())
events = stripe.Event.list(created={"gte": cutoff}, limit=1000)

data = [event.to_dict() for event in events.auto_paging_iter()]
with open("stripe_webhook_logs.json", "w") as f:
    json.dump(data, f, indent=2)
```

### Key Events to Verify
- `checkout.session.completed` — Subscription created
- `customer.subscription.created` — Subscription active
- `customer.subscription.updated` — Plan change/renewal
- `customer.subscription.deleted` — Cancellation
- `invoice.payment_succeeded` — Recurring payment
- `invoice.payment_failed` — Failed payment (dunning)

### Expected Format
```json
[
  {
    "id": "evt_123",
    "type": "checkout.session.completed",
    "created": 1723401600,
    "data": {
      "object": {
        "id": "cs_123",
        "customer": "cus_123",
        "subscription": "sub_123",
        "amount_total": 1900,
        "currency": "usd",
        "metadata": {"user_id": "uuid", "plan": "b2c"}
      }
    }
  }
]
```

---

## 3. Stripe Revenue Export (revenue/stripe_export.json)

### Source
Stripe Dashboard → Payments → Export OR Subscriptions → Export

### How to Export
1. Dashboard → Payments → "Export" button (top right)
2. Date range: Hackathon period
3. Format: JSON
4. Also export Subscriptions separately
5. Combine or save both in `revenue/`

### Verification
- [ ] All payments from hackathon period
- [ ] Includes successful + failed (for completeness)
- [ ] Metadata shows `user_id` and `plan` for attribution
- [ ] Matches P&L revenue numbers

---

## Checklist Before Submission

| File | Generated | Verified |
|------|-----------|----------|
| `api_usage/gemini_usage.json` | ⬜ | ⬜ |
| `api_usage/stripe_webhook_logs.json` | ⬜ | ⬜ |
| `revenue/stripe_export.json` | ⬜ | ⬜ |
| `revenue/pnl.csv` | ⬜ | ⬜ |
| `revenue/expense_disclosure.md` | ⬜ | ⬜ |

---

**Note:** All exports must cover the **exact 90-day hackathon period**. Do not include data from before/after.