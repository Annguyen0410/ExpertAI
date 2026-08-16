# ExpertAI — Build with Gemini Hackathon Narrative

## What is ExpertAI?

ExpertAI is a conversational AI platform that puts professional-grade knowledge — legal, financial, and medical — directly in the hands of everyday people for a fraction of the cost of a consultation. Powered by Gemini, it does not simply answer questions. It **triages** each request, **routes** it to a domain specialist, answers with educational context and a clear disclaimer, and — when a situation is genuinely high-stakes — **escalates** to a human professional for follow-up. Every decision is recorded in an auditable execution trace. It is a full triage-and-escalation system built on a safety-first architecture, not a chatbot that pretends to be a lawyer.

## The problem

Millions of people face legal, financial, and health questions but cannot afford a $300/hour attorney, a $200 CPA consult, or an urgent-care copay just to ask "is this actually a problem?" General-purpose search engines return scattered forum answers with no accountability, and existing legal-tech tools assume the user already knows which category their problem falls into. Real-world problems rarely arrive pre-labeled. A person asking about a withheld security deposit, a first-year freelancer's tax withholdings, or a persistent chest pain does not know — and should not have to know — whether their issue is legal, financial, or medical. That classification is exactly where a well-engineered AI can help.

## What we built with Gemini

The entire reasoning engine runs on the Gemini model family through a multi-agent pipeline:

- **TriageAgent** classifies every query into legal / financial / medical, assigns a complexity score, and decides whether it is safe to answer automatically or requires a human.
- **Specialist agents** — LegalAgent, FinancialAgent, MedicalAgent — generate grounded, educational responses scoped to the user's jurisdiction and context, always with an explicit disclaimer that they provide educational information, not advice.
- **FollowUpAgent** recommends concrete next steps so the user leaves with an action plan.
- **EscalationAgent** drafts a professional intake brief for high-risk cases, such as a possible medical emergency.
- **SafetyBoundary** guards against prompt-injection and untrusted input by treating user content strictly as data.

Every agent action is written to an **execution log** — agent name, action, decision, confidence score, latency, and status — so users, professionals, and admins can see exactly how the AI reasoned. This transparency is our key differentiator and is central to building trust with both consumers and licensed professionals.

## How the money works

Pricing is live: **$19/month** for individuals (B2C) and **$99/month** for businesses (B2B), both via Stripe subscriptions with real checkout. Revenue is real and recurring.

## Traction

ExpertAI is **live in production** with **real paying customers** and **real Stripe revenue**. We onboarded our first paying customer by sharing the product directly within our personal network — organic growth with **$0 spent on paid marketing**. [Update: N paying customers, ~$X/month MRR, N% AI resolution rate.]

## Safety & responsibility

We take the risk of professional-adjacent answers seriously:
- Every response carries a mandatory disclaimer ("ExpertAI provides educational information, not legal/medical/financial advice").
- High-stakes queries are **never** fully auto-resolved — they are escalated to a human professional through the professional portal.
- All user input passes through SafetyBoundary to defend against prompt injection.
- Admins monitor an operations dashboard tracking AI resolution rate, escalation rate, and revenue.

## How to use it

1. Ask a question in plain language.
2. TriageAgent classifies it (legal / financial / medical) and assigns a complexity score.
3. A specialist agent answers with educational context plus a disclaimer.
4. FollowUpAgent suggests next steps.
5. If high-risk, EscalationAgent drafts a professional referral brief.
6. Professionals review cases in the professional portal; admins monitor the operations dashboard.

## Why Gemini

Gemini's capability and its cost-efficient flash-class models let us run a complete multi-agent pipeline — triage, specialist, follow-up, escalation — on every query at a price point that makes consumer-priced professional guidance viable. The ability to execute a transparent, auditable agent chain per request is what turns a generic chatbot into a responsible expertise platform.

## Team

[Founder name] — [role(s)] — solo builder of ExpertAI.

## The future

Next we plan to add licensed-professional review workflows in more jurisdictions, richer document analysis, and usage-based API access so other products can embed safe professional guidance. The architecture is built to extend far beyond these three domains.