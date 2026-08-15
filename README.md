# ExpertAI

**ExpertAI: An AI-operated gateway to professional services**

ExpertAI makes professional information more accessible through a Gemini-powered triage and specialist workflow. It routes legal, financial, and medical information requests to the appropriate AI specialist, records the decision trail, and escalates high-risk matters to qualified humans instead of treating AI output as professional advice.

> **Safety boundary:** ExpertAI provides educational information, not legal, medical, or financial advice. Emergency, high-risk, and specialist-required requests are designed to be escalated. Do not rely on it as a replacement for a licensed professional.

---

## The Problem

Legal, financial, and medical information is expensive, slow, and rarely available when people need it most. A tenant facing a lease at 11pm, a freelancer doing first-time taxes, or a patient preparing for an appointment has no affordable on-ramp — and professionals drown in repetitive intake work.

## The Solution

ExpertAI is a production business that operates through AI agents. A user asks a question in plain language; a team of Gemini agents triages it, routes it to a legal, financial, or medical specialist, drafts an educational response, and keeps a full audit trail. High-risk matters are never answered by the machine — they are escalated to qualified humans with a packaged intake brief.

### AI-Native Operations — What the AI Decides

The core claim is not that we "use AI somewhere." Every query is operated by agents in production:

| Agent | Responsibility |
|-------|----------------|
| **TriageAgent** | Decides the domain, complexity (0–1), and whether the request needs human judgment |
| **Specialist Agents** (Legal, Financial, Medical) | Generate guidance with built-in disclaimers and refusal rules |
| **FollowUpAgent** | Recommends next steps per conversation |
| **EscalationAgent** | Decides when to route to a professional and creates the intake summary |
| **SafetyBoundary** | Guards against prompt injection by treating all user input as data |
| **BusinessIntelligenceAgent** | Reads our own revenue and metrics to recommend business moves |

Each decision is persisted as an execution row — agent, action, decision, confidence, latency, status — viewable in the product and exported as evidence. On a free tier of 3 queries plus 2 follow-ups, the AI resolves the majority of requests autonomously; the remainder is deliberately given to people.

### What Humans Do

AI does the routine knowledge work. Humans hold the judgment: professionals review escalated cases through a dedicated portal, and the AI never impersonates them. This is a division of labor, not a replacement of it.

### Business Model and Revenue

ExpertAI sells two subscriptions: Individual ($19/mo) and Professional ($99/mo), collected through live Stripe checkout with verified webhooks. As of submission: **[X] total revenue, [Y] active paying customers, [Z]% AI resolution rate, [W]/5 average rating** (full revenue evidence, P&L, and marketing-expense disclosure are attached in `/submission`). Operations live at **[production URL]**.

### Jobs and Economic Opportunity

ExpertAI creates work rather than destroying it:
1. **Turns escalations into paid referrals** — a steady pipeline of vetted client intakes for lawyers, CPAs, and clinicians who otherwise spend hours qualifying leads
2. **Lowers the cost of professional entry** — people who could not afford a consult can prepare, then arrive at a professional ready to act — meaning professionals serve more clients per hour
3. **Builds a sustainable model** where automation handles low-value intake and people capture the high-value judgment work

Every escalated case is an economic opportunity for a professional; every answered question is access for someone who previously had none.

### Building It in 90 Days

We started with a single principle: **accountability**. The architecture reflects it — agents have no tools, no database access, and no ability to overstep; the router validates and persists every business action. We built the FastAPI orchestration and Gemini agent layer first, then the Next.js dashboard, workspace, and operations views, then the Stripe subscription flow, and finally the professional portal. We shipped continuously, ran the service against real users, and let production metrics — not assumptions — tell us what mattered.

---

## What Is Implemented

- FastAPI API with authenticated, tenant-scoped queries and conversations
- Gemini-backed triage plus legal, financial, and medical specialist agents
- Durable agent execution records (agent → decision → action → result)
- Risk-aware escalation workflow for professional review
- File upload validation and document metadata/analysis workflow
- Subscription-ready Stripe checkout and verified webhook integration
- Next.js dashboard, query workspace, operations view, professional queue, and account settings

---

## Architecture

```text
Next.js client
    │ authenticated API requests
    ▼
FastAPI
 ├── auth, authorization, rate limiting, security headers
 ├── triage → specialist agent → safety / escalation decision
 ├── query, message, document, execution-log, and escalation persistence
 └── Stripe webhook and operational analytics
    │
    ├── Gemini (when GEMINI_API_KEY is configured)
    ├── optional Cloud Storage for documents (GCS)
    └── SQLite for local development / managed Postgres for production
```

---

## Project Structure

```
ExpertAI Devpost/
├── backend/                    # FastAPI application
│   ├── agents/                 # AI agents (triage, legal, financial, medical, operations)
│   │   ├── base.py            # Base agent class with Gemini integration
│   │   ├── triage.py          # Risk-aware request classification
│   │   ├── legal.py           # Legal specialist agent
│   │   ├── financial.py       # Financial specialist agent
│   │   ├── medical.py         # Medical specialist agent
│   │   └── operations.py      # BusinessIntelligence, CustomerSupport, DocumentAnalysis, Escalation, FollowUp
│   ├── routers/               # API endpoints
│   │   ├── agents.py          # Query orchestration, conversations, execution traces
│   │   ├── auth.py            # Authentication, registration, password reset
│   │   ├── analytics.py       # Operational analytics endpoints
│   │   ├── documents.py       # File upload, document analysis
│   │   ├── professional.py    # Professional referral queue, claims, responses
│   │   └── subscriptions.py   # Stripe checkout, webhooks, subscription management
│   ├── models/                # SQLAlchemy models
│   │   └── __init__.py        # User, Query, Message, Document, Escalation, AgentExecutionLog, etc.
│   ├── config.py              # Centralized, fail-closed runtime configuration
│   ├── database.py            # Database connection and session management
│   ├── auth.py                # JWT authentication, password hashing
│   ├── security.py            # Rate limiting, input sanitization, security headers
│   ├── email_service.py       # Transactional email (Resend/SMTP)
│   ├── stripe_sync.py         # Stripe customer/subscription synchronization
│   ├── main.py                # FastAPI application entry point
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Environment variable template
│
├── frontend/                   # Next.js 14 application
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── page.js                    # Landing page
│   │   │   ├── dashboard/                 # User dashboard
│   │   │   ├── query/                     # Query workspace
│   │   │   │   ├── page.js                # Query list
│   │   │   │   └── [id]/page.js           # Query detail with execution logs
│   │   │   ├── operations/page.js         # Operations dashboard (admin view)
│   │   │   ├── professional/page.js       # Professional portal (escalation queue)
│   │   │   ├── pricing/page.js            # Subscription pricing
│   │   │   ├── settings/page.js           # Account settings
│   │   │   ├── signin/                    # Sign in page
│   │   │   ├── signup/                    # Sign up page
│   │   │   ├── forgot-password/           # Password reset request
│   │   │   └── reset-password/            # Password reset form
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # React context providers (Auth, Toast)
│   │   └── lib/               # Utilities (API client, theme, domains)
│   ├── package.json           # Node dependencies
│   ├── next.config.mjs        # Next.js configuration
│   └── .env.example           # Environment variable template
│
├── submission/                 # Hackathon submission evidence (THIS FOLDER)
│   ├── README.md              # Submission evidence index
│   ├── video/                 # 3-minute demo video
│   ├── screenshots/           # Product evidence screenshots
│   ├── revenue/               # Stripe exports, P&L, expense disclosure
│   ├── customers/             # Customer evidence (with permission)
│   ├── execution_logs/        # Exported agent execution logs
│   └── api_usage/             # Gemini API usage, Stripe API logs
│
├── docker-compose.yml         # Local development stack
├── Dockerfile.backend         # Backend container
├── Dockerfile.frontend        # Frontend container
├── .dockerignore              # Excludes .env, databases, caches from images
├── .gitignore                 # Excludes secrets, local DB, build artifacts
├── SECURITY.md                # Security documentation
└── README.md                  # This file
```

---

## Local Development

Prerequisites: Node 20+, Python 3.11+, and (for live AI) a Gemini API key.

1. Copy the root template to `.env` and set non-placeholder values. **Never commit this file.**
2. Create `backend/.env` from `backend/.env.example` if you run the API directly from the `backend` directory.
3. Install and run the backend:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
4. In a second terminal, install and run the frontend:
   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

Open `http://localhost:3000`. The API health endpoint is `http://localhost:8000/health`.

---

## Environment

Required for production:

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Unique high-entropy signing key; do not use a development default. |
| `CORS_ORIGINS` | Explicit comma-separated trusted frontend origins. |
| `DATABASE_URL` | Managed Postgres URL recommended in production. |
| `GEMINI_API_KEY` | Enables live Gemini agent execution. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Enables live billing and webhook verification. |
| `NEXT_PUBLIC_API_URL` | Public API base URL used by the frontend. |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket for document persistence. |
| `B2C_PRICE_ID` / `B2B_PRICE_ID` | Stripe price IDs for Individual/Professional plans. |

`B2C_PRICE_ID` and `B2B_PRICE_ID` must reference real Stripe price IDs before live checkout is enabled. Cloud Storage is optional; configure it only when the application identity has the minimum permissions needed for the document bucket.

---

## Docker

```bash
docker compose up --build
```

Compose persists its local SQLite database under `./data`. For production, provide a managed `DATABASE_URL`, use a secret manager for credentials, and terminate TLS at a managed ingress or load balancer. The `.dockerignore` file prevents local environment files, databases, and build caches from being baked into the images.

---

## Production Checklist

- Rotate any key that has appeared in a commit, log, or shared document.
- Use a dedicated production `SECRET_KEY`, strict HTTPS origins, and a managed database with backups.
- Set live Stripe secrets only after validating webhooks in a test environment.
- Restrict API documentation and diagnostics according to the deployment environment.
- Configure centralized logs, alerts, and retention appropriate for sensitive professional-services data.
- Review the security notes in [SECURITY.md](SECURITY.md) before launch.

---

## Verification

Run the API checks and frontend checks after making changes:

```bash
# backend (from backend/)
python -m compileall .

# frontend (from frontend/)
npm run lint
npm run build
```

---

## Run Website (Local)

```powershell
# backend
cd "D:\Code folder\ExpertAI Devpost\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend 
cd "D:\Code folder\ExpertAI Devpost\frontend"
npm run dev
```

---

## Hackathon Submission

### Category: Professional Services Access

ExpertAI is designed for the **Professional Services Access** category: routine information work is available around the clock, while high-value or high-risk work creates a structured referral opportunity for professionals. The demo shows a real query flowing through triage, a specialized agent, an auditable decision trail, and—when appropriate—a human escalation.

### Submission Checklist

- [x] GitHub repo shared with `testing@devpost.com` AND `judging@hacker.fund`
- [x] Repo is clean (no `.env`, secrets, local DB `expertai.db`)
- [x] 3-minute video demonstrating live AI agent execution (`/submission/video/`)
- [x] Written narrative (this README) — 500–1000 words on AI operations, human roles, economic impact
- [x] Revenue evidence: Stripe dashboard export (`/submission/revenue/`)
- [x] Simple P&L with marketing/customer acquisition spend disclosure (`/submission/revenue/`)
- [x] Product evidence: execution logs, API usage records, dashboard screenshots (`/submission/screenshots/`, `/submission/execution_logs/`, `/submission/api_usage/`)
- [x] Customer evidence: contact info + testimonials with permission (`/submission/customers/`)

### Judging Criteria Alignment

| Criterion | How ExpertAI Addresses It |
|-----------|---------------------------|
| **Business Viability** | Live Stripe subscriptions, real paying customers, recurring revenue model, disclosed P&L with all expenses |
| **AI-Native Operations** | Every query processed by agent chain (Triage → Specialist → FollowUp/Escalation), full execution audit trail persisted and viewable in `/operations` dashboard |
| **Category Impact** | Creates professional referral pipeline, lowers access barriers, sustainable human-AI division of labor in Professional Services Access |

---

## Submission Evidence Folder: `/submission`

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

---

## License

This project is submitted for the "Build with Gemini" hackathon. All rights reserved.