# ExpertAI

ExpertAI makes professional information more accessible through a Gemini-powered
triage and specialist workflow. It routes legal, financial, and medical
information requests to the appropriate AI specialist, records the decision
trail, and escalates high-risk matters to qualified humans instead of treating
AI output as professional advice.

> **Safety boundary:** ExpertAI provides educational information, not legal,
> medical, or financial advice. Emergency, high-risk, and specialist-required
> requests are designed to be escalated. Do not rely on it as a replacement for
> a licensed professional.

## What is implemented

- FastAPI API with authenticated, tenant-scoped queries and conversations.
- Gemini-backed triage plus legal, financial, and medical specialist agents.
- Durable agent execution records (agent → decision → action → result).
- Risk-aware escalation workflow for professional review.
- File upload validation and document metadata/analysis workflow.
- Subscription-ready Stripe checkout and verified webhook integration.
- Next.js dashboard, query workspace, operations view, professional queue, and
  account settings.

The application deliberately does **not** manufacture customer, revenue, or
performance metrics. When an optional service is not configured, its state is
presented as unavailable or in local development mode rather than as live
production evidence.

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
    ├── optional Cloud Storage for documents
    └── SQLite for local development / managed Postgres for production
```

## Local development

Prerequisites: Node 20+, Python 3.11+, and (for live AI) a Gemini API key.

1. Copy the root template to `.env` and set non-placeholder values. Never
   commit this file.
2. Create `backend/.env` from `backend/.env.example` if you run the API
   directly from the `backend` directory.
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

Open `http://localhost:3000`. The API health endpoint is
`http://localhost:8000/health`.

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

`B2C_PRICE_ID` and `B2B_PRICE_ID` must reference real Stripe price IDs before
live checkout is enabled. Cloud Storage is optional; configure it only when the
application identity has the minimum permissions needed for the document bucket.

## Docker

```bash
docker compose up --build
```

Compose persists its local SQLite database under `./data`. For production,
provide a managed `DATABASE_URL`, use a secret manager for credentials, and
terminate TLS at a managed ingress or load balancer. The `.dockerignore` file
prevents local environment files, databases, and build caches from being baked
into the images.

## Production checklist

- Rotate any key that has appeared in a commit, log, or shared document.
- Use a dedicated production `SECRET_KEY`, strict HTTPS origins, and a managed
  database with backups.
- Set live Stripe secrets only after validating webhooks in a test environment.
- Restrict API documentation and diagnostics according to the deployment
  environment.
- Configure centralized logs, alerts, and retention appropriate for sensitive
  professional-services data.
- Review the security notes in [SECURITY.md](SECURITY.md) before launch.

## Verification

Run the API checks and frontend checks after making changes:

```bash
# backend (from backend/)
python -m compileall .

# frontend (from frontend/)
npm run lint
npm run build
```

## Run Website:

# backend
cd "D:\Code folder\ExpertAI Devpost\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend 
cd "D:\Code folder\ExpertAI Devpost\frontend"
npm run dev

## Hackathon positioning

ExpertAI is designed for the Professional Services Access category: routine
information work is available around the clock, while high-value or high-risk
work creates a structured referral opportunity for professionals. The demo
should show a real query flowing through triage, a specialized agent, an
auditable decision trail, and—when appropriate—a human escalation.
