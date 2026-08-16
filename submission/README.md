# ExpertAI Hackathon Submission Evidence

This folder contains all evidence required for the "Build with Gemini" hackathon submission.

## Folder Structure

```
submission/
├── README.md                    # This index file
├── video/
│   └── expert_ai_demo.mp4       # 3-min demo: query → triage → specialist → execution trace → escalation → professional portal
├── screenshots/
│   ├── 01_triage_result.png          # TriageAgent classification output
│   ├── 02_specialist_response.png    # Legal/Financial/Medical agent response
│   ├── 03_execution_trace.png        # Agent execution log detail view
│   ├── 04_escalation_created.png     # Escalation intake brief
│   ├── 05_operations_dashboard.png   # /operations live dashboard
│   ├── 06_stripe_revenue.png         # Stripe Dashboard revenue export
│   └── 07_database_schema.png        # Key tables: queries, execution_logs, escalations
├── revenue/
│   ├── stripe_export.json            # Stripe Dashboard export (payments, subscriptions)
│   ├── pnl.csv                       # Simple P&L: revenue, COGS, marketing, hosting, API costs
│   └── expense_disclosure.md         # Marketing/customer acquisition spend (required even if $0)
├── customers/
│   ├── customer_list.csv             # Name, email, phone (with permission)
│   └── testimonials/                 # Written feedback/screenshots from customers
├── execution_logs/
│   ├── execution_logs_export.json    # Full AgentExecutionLog export (last 30 days)
│   └── sample_traces.md              # Annotated example traces with explanations
└── api_usage/
    ├── gemini_usage.json             # Gemini API usage records
    └── stripe_webhook_logs.json      # Verified Stripe webhook events
```

## Evidence Checklist

| Requirement | Status | Location |
|-------------|--------|----------|
| 3-minute demo video | ✅ Done | `video/ExpertAI - Devpost Gemini Xprize - Huynh Thien An Nguyen.mp4` |
| Product screenshots (7) | ✅ Done | `screenshots/` |
| Narrative (500-1000 words) | ✅ Done | `narrative.md` |
| Stripe revenue export | ⬜ Pending | `revenue/stripe_export.json` |
| Simple P&L | ⬜ Pending (fill revenue) | `revenue/pnl.csv` |
| Marketing expense disclosure | ✅ Done (all $0) | `revenue/expense_disclosure.md` |
| Customer list + testimonials | ⬜ Pending (add data) | `customers/` |
| Agent execution logs export | ✅ Done (21 logs) | `execution_logs/execution_logs_export.json` |
| API usage records (Gemini, Stripe) | ✅ Gemini done | `api_usage/gemini_usage.json`, `api_usage/stripe_webhook_logs.json` |

## How to Generate Evidence

### 1. Screenshots (from production deployment)
Navigate to your live deployment and capture:
- **01_triage_result.png**: Query detail page showing TriageAgent classification
- **02_specialist_response.png**: Specialist agent response with disclaimer
- **03_execution_trace.png**: Query detail → Execution Logs tab
- **04_escalation_created.png**: Professional portal showing new escalation with case summary
- **05_operations_dashboard.png**: `/operations` page showing analytics
- **06_stripe_revenue.png**: Stripe Dashboard → Payments/Subscriptions
- **07_database_schema.png**: Database schema diagram or key table views

### 2. Stripe Export
1. Go to Stripe Dashboard → Payments → Export
2. Go to Stripe Dashboard → Subscriptions → Export
3. Save as `stripe_export.json`

### 3. P&L Template (revenue/pnl.csv)
```csv
Category,Amount (USD),Notes
Revenue - Individual Subscriptions,XXX,Stripe B2C price $19/mo
Revenue - Professional Subscriptions,XXX,Stripe B2B price $99/mo
Total Revenue,XXX,
COGS - Gemini API,XXX,From api_usage/gemini_usage.json
COGS - Stripe Fees (2.9% + 30¢),XXX,Calculated from revenue
Hosting (Render/Cloud Run),XXX,Monthly infrastructure
Domain/SSL,XXX,Annual prorated
Marketing & Customer Acquisition,XXX,MUST disclose even if $0
Other Expenses,XXX,
Total Expenses,XXX,
Net Profit/Loss,XXX,
```

### 4. Marketing Expense Disclosure (revenue/expense_disclosure.md)
```markdown
# Marketing & Customer Acquisition Spend Disclosure

**Hackathon Period:** [Start Date] to [End Date]

| Channel | Spend (USD) | Details |
|---------|-------------|---------|
| Paid Ads (Google/Meta) | $XXX | Campaign names, dates |
| Content/SEO | $XXX | Tools, freelance writers |
| Outreach/Sales | $XXX | Tools, time valuation |
| Events/Networking | $XXX | Conference tickets, travel |
| **Total** | **$XXX** | **Required even if $0** |

> Note: This disclosure is mandatory per hackathon rules. If $0, state "$0 — organic growth only."
```

### 5. Customer Evidence (customers/customer_list.csv)
```csv
Name,Email,Phone,Plan,Signup Date,Testimonial Provided,Permission Granted
John Doe,john@example.com,+1-555-0101,Individual,2026-07-15,Yes,Yes
Jane Smith,jane@example.com,+1-555-0102,Professional,2026-07-20,Yes,Yes
```

Save testimonials as individual files in `customers/testimonials/` (e.g., `john_doe.txt`, `jane_smith.txt`)

### 6. Execution Logs Export
Run this SQL query on production database and export as JSON:
```sql
SELECT * FROM agent_execution_logs 
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```
Save as `execution_logs/execution_logs_export.json`

### 7. Sample Traces (execution_logs/sample_traces.md)
Document 3-5 example traces with annotations:
- Trace 1: Simple legal query → LegalAgent → completed
- Trace 2: Medical emergency symptoms → TriageAgent → EscalationAgent → professional referral
- Trace 3: Financial tax question → FinancialAgent → FollowUpAgent → next steps

### 8. API Usage Records
- **Gemini**: Export from Google AI Studio / Vertex AI console
- **Stripe Webhooks**: Export from Stripe Dashboard → Developers → Webhook endpoints → delivery logs

---

## Submission Contacts

- **GitHub Repo**: `github.com/Annguyen0410/ExpertAI` — shared with `testing@devpost.com` AND `judging@hacker.fund`
- **Production URL**: [Add your live URL]
- **Team Contact**: [Add team lead email]
- **Team Lead / Builder**: Huynh Thien An Nguyen

---

*Generated for ExpertAI "Build with Gemini" hackathon submission — August 2026*