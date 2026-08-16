# ExpertAI — Build with Gemini Hackathon Submission

ExpertAI is a conversational AI platform that delivers professional-grade legal, financial, and medical guidance through a Gemini-powered multi-agent pipeline, with human escalation for high-stakes cases.

## Live Product

- **Production URL:** https://expertai-io.onrender.com
- **Source Repository:** github.com/Annguyen0410/ExpertAI

## Submission Evidence

```
submission/
├── narrative.md                        # 500-1000 word narrative
├── video/                              # 3-minute demo video
├── screenshots/                        # 7 product screenshots
├── revenue/
│   ├── pnl.csv                         # Profit & Loss
│   ├── expense_disclosure.md           # Marketing/CAC disclosure (all $0, organic)
│   └── stripe_export.json              # Stripe revenue export
├── customers/
│   └── customer_list.csv               # Real paying customers
├── execution_logs/
│   └── execution_logs_export.json      # Agent execution logs (last 30 days)
└── api_usage/
    ├── gemini_usage.json               # Gemini usage estimate from execution logs
    └── stripe_webhook_logs.json        # Stripe webhook events
```

## Evidence Checklist

| Requirement | Status | Location |
|-------------|--------|----------|
| 3-minute demo video | Done | `video/ExpertAI - Devpost Gemini Xprize - Huynh Thien An Nguyen.mp4` |
| Product screenshots (7) | Done | `screenshots/` |
| Narrative (500-1000 words) | Done | `narrative.md` |
| Stripe revenue export | Pending | `revenue/stripe_export.json` |
| Simple P&L | Done | `revenue/pnl.csv` |
| Marketing expense disclosure | Done (all $0, organic) | `revenue/expense_disclosure.md` |
| Customer list | Done | `customers/customer_list.csv` |
| Agent execution logs export | Done (21 logs) | `execution_logs/execution_logs_export.json` |
| API usage records | Done | `api_usage/gemini_usage.json`, `api_usage/stripe_webhook_logs.json` |

## Team

- **Builder / Team Lead:** Huynh Thien An Nguyen
- **Contact:** [Add team lead email]

*Prepared for the "Build with Gemini" XPRIZE Devpost submission — August 2026.*