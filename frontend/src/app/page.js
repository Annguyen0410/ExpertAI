"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Check, Bot, Users,
  TrendingUp, Shield, Cpu, Activity, FileText,
  ChevronRight, BarChart3, TriangleAlert
} from "lucide-react";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import { DOMAINS } from "../lib/domains";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  // Public pages deliberately do not request account-only testimonial or analytics data.
  const testimonials = [];

  function beginSignup() {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setEmailError("Enter a valid email address or leave this field blank to continue.");
      return;
    }
    if (normalizedEmail) {
      localStorage.setItem("expertai_signup_email", normalizedEmail);
      router.push(`/signup?email=${encodeURIComponent(normalizedEmail)}`);
      return;
    }
    router.push("/signup");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-line">
        <Logo />
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-ink-2 hover:text-ink hidden sm:block">Pricing</Link>
          <Link href="/signin" className="text-sm text-ink-2 hover:text-ink transition-colors">Sign In</Link>
          <ThemeToggle />
          <Link href="/signup" className="text-sm bg-primary hover:bg-primary-strong px-4 py-2 rounded-lg font-medium transition-all">Get Started</Link>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-legal/15 pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-legal/10 blur-3xl pointer-events-none" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
            <Shield className="w-3.5 h-3.5" />
            Professional Services Access
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight max-w-4xl leading-tight">
            Professional Expertise,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-legal">Democratized by AI</span>
          </h1>
          <p className="text-lg md:text-xl text-ink-2 mt-6 max-w-2xl">
            Understand your next step across legal, financial, and medical topics with structured AI guidance.
            Higher-risk questions can be prepared for professional review.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-10 w-full max-w-md" aria-describedby={emailError ? "hero-email-error" : undefined}>
            <label className="sr-only" htmlFor="hero-email">Email address</label>
            <input
              id="hero-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              className="flex-1 px-4 py-3 rounded-xl bg-surface border border-line text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button type="button" onClick={beginSignup} className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-strong px-6 py-3 rounded-xl font-semibold transition-all">
              Start Free <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {emailError ? <p id="hero-email-error" role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-3">{emailError}</p> : <p className="text-sm text-ink-3 mt-3">Start with the free tier. No card is required to create an account.</p>}
        </div>
      </section>

      <section className="px-6 py-20 border-t border-line bg-surface/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-4">
              <Cpu className="w-3.5 h-3.5" /> AI-NATIVE OPERATIONS
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold">Designed for accountable AI assistance</h2>
            <p className="text-ink-2 mt-4 text-lg max-w-3xl mx-auto">
              Each query follows a visible workflow so people can understand how it was routed, handled, and when professional judgment is needed.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Activity, title: "Structured triage", desc: "A routing step identifies the likely domain, complexity, and whether a question warrants professional attention.", color: "text-financial", bg: "bg-financial/10" },
              { icon: BarChart3, title: "Visible execution trail", desc: "The query workspace records the agent, decision, action, result, and timing so the experience is inspectable.", color: "text-legal", bg: "bg-legal/10" },
              { icon: TrendingUp, title: "Human expertise in the loop", desc: "Escalated cases are prepared with context for professionals, keeping judgment with the people accountable for it.", color: "text-primary", bg: "bg-primary/10" },
            ].map((item) => (
              <div key={item.title} className={`p-6 rounded-2xl ${item.bg} border border-line bg-surface`}>
                <item.icon className={`w-8 h-8 ${item.color} mb-3`} />
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-line">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-semibold">Three Domains. One AI.</h2>
            <p className="text-ink-2 mt-4 text-lg">Specialized workflows for common professional-service questions.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {DOMAINS.map((item) => (
              <div key={item.id} className={`p-8 rounded-2xl bg-surface border ${item.border} hover:shadow-xl hover:shadow-ink/5 transition-shadow`}>
                <div className={`w-12 h-12 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center mb-4`}>
                  <item.icon className={`w-6 h-6 ${item.text}`} />
                </div>
                <h3 className="text-xl font-semibold mb-1">{item.expertLabel}</h3>
                <p className={`text-xs uppercase tracking-wider ${item.text} mb-3`}>{item.label} domain</p>
                <p className="text-ink-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-line bg-surface/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold mb-6">AI-Native Pipeline</h2>
              <div className="space-y-8">
                {[
                  { step: "01", title: "Triage", desc: "The service identifies the likely domain and gives the request a complexity and safety review.", icon: Bot },
                  { step: "02", title: "Guidance", desc: "A domain-specific workflow produces an understandable response, with documents available as supporting context.", icon: FileText },
                  { step: "03", title: "Escalation", desc: "Questions that need professional judgment are marked clearly and packaged with relevant context for review.", icon: TriangleAlert },
                  { step: "04", title: "Audit trail", desc: "The workspace keeps a timestamped record of agent decisions and responses for transparent follow-through.", icon: TrendingUp },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="text-primary font-bold text-lg shrink-0">{item.step}</div>
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2"><item.icon className="w-4 h-4 text-primary" /> {item.title}</h3>
                      <p className="text-ink-2">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-primary/10 to-legal/10 rounded-3xl p-8 border border-line bg-surface">
                <Bot className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-4">Traceable by design</h3>
                <p className="text-ink-2 leading-relaxed mb-4">
                  Follow the system&rsquo;s decision trail from triage through response or escalation. Operational views only show data available to the signed-in account.
                </p>
                <Link href="/operations" className="inline-flex items-center gap-2 text-primary hover:text-primary-strong font-medium">
                  View operations workspace <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-3">
                {["Gemini-powered triage", "Document workspace", "Professional escalation", "Decision audit trail"].map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-surface-2 rounded-full text-sm text-ink-2 border border-line">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="px-6 py-20 border-t border-line bg-surface/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-semibold">What Users Say</h2>
              <p className="text-ink-2 mt-4 text-lg">Real feedback from ExpertAI users.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.slice(0, 3).map((t) => (
                <div key={t.id} className="bg-surface rounded-2xl p-6 border border-line">
                  <div className="flex items-center gap-1 mb-3">
                    {[1,2,3,4,5].map((star) => (
                      <span key={star} className={`text-sm ${star <= t.rating ? "text-amber-500" : "text-ink-3"}`}>★</span>
                    ))}
                  </div>
                  <p className="text-sm text-ink-2 mb-3 leading-relaxed">&ldquo;{(t.testimonial_text || "").substring(0, 200)}&rdquo;</p>
                  <p className="text-xs text-ink-3">{t.user_name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-20 border-t border-line">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-ink-2 mb-12">From free individual access to professional-grade tools.</p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: "Free", price: "$0", period: "forever", desc: "Try the core workflow", features: ["3 queries/month", "Guidance across supported domains", "Conversation history", "Escalation indicators"], cta: "Start Free", href: "/signup", featured: false },
              { name: "Individual", price: "$19", period: "/month", desc: "For ongoing guidance", features: ["Expanded query access", "All supported domains", "Document upload workspace", "Professional escalation access"], cta: "View plan", href: "/pricing", featured: true },
              { name: "Professional", price: "$99", period: "/month", desc: "For verified professional service providers", features: ["AI client intake", "Triage and routing", "Escalation workspace", "Case response tools"], cta: "View plan", href: "/pricing", featured: false },
            ].map((plan) => (
              <div key={plan.name} className={`rounded-2xl p-8 border text-left bg-surface ${plan.featured ? "border-accent/40 bg-accent/5 relative" : "border-line"}`}>
                {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent/15 border border-accent/30 text-accent text-xs font-semibold px-3 py-1 rounded-full">Most Popular</div>}
                <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2"><span className="text-4xl font-bold">{plan.price}</span><span className="text-ink-3">{plan.period}</span></div>
                <p className="text-sm text-ink-2 mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-8">{plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-ink-2"><Check className="w-4 h-4 text-financial shrink-0" />{f}</li>
                ))}</ul>
                <Link href={plan.href} className={`block text-center py-3 rounded-xl font-semibold transition-all ${plan.featured ? "bg-primary hover:bg-primary-strong" : "bg-surface-2 hover:bg-surface border border-line"}`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-line bg-gradient-to-b from-surface/50 to-bg">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-6">Professional guidance should be easier to access</h2>
          <p className="text-ink-2 text-lg max-w-3xl mx-auto mb-12">
            ExpertAI helps people organize questions, understand general information, and reach qualified help when a situation needs it.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { label: "Available", value: "24/7", icon: TrendingUp },
              { label: "Guidance", value: "Clear", icon: Bot },
              { label: "Escalation", value: "Human", icon: Users },
              { label: "Decisions", value: "Visible", icon: Check },
            ].map((stat) => (
              <div key={stat.label}>
                <stat.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-ink-3">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-line text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-6">Ready to Democratize Expertise?</h2>
          <p className="text-ink-2 text-lg mb-8">Join ExpertAI today. Free tier available. No credit card needed.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-strong px-8 py-4 rounded-xl font-semibold text-lg transition-all">
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/operations" className="inline-flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface px-8 py-4 rounded-xl font-semibold text-lg transition-all border border-line">
              Explore the workflow <Activity className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-line">
        <div className="max-w-6xl mx-auto text-center text-sm text-ink-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Logo size="sm" />
          </div>
          <p className="mb-2">AI-assisted guidance is not a substitute for licensed legal, financial, or medical professionals.</p>
          <p>Built around accessible professional services and accountable human escalation.</p>
        </div>
      </footer>
    </div>
  );
}