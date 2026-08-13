"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, ArrowLeft, Loader, FileText, Sparkles, History, Trash2, TriangleAlert } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { authorizedFetch } from "../../lib/api";
import ThemeToggle from "../../components/ThemeToggle";
import DomainBadge from "../../components/DomainBadge";
import { DOMAINS } from "../../lib/domains";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("token");
  return null;
}

const DRAFT_KEY = "expertai_draft";

const TEMPLATES = [
  { domain: "legal", label: "Review a Lease", prompt: "I need to review a residential lease agreement. What are the key clauses I should look out for, and what are common red flags?" },
  { domain: "legal", label: "NDA Review", prompt: "I received a Non-Disclosure Agreement to sign. Can you help me understand the key terms and what to watch out for?" },
  { domain: "legal", label: "Tenant Rights", prompt: "My landlord is withholding my security deposit. What are my rights and what steps should I take?" },
  { domain: "financial", label: "Budget Planning", prompt: "Help me create a monthly budget. I earn $X per month and want to save more effectively." },
  { domain: "financial", label: "Tax Tips", prompt: "I'm a freelancer filing taxes for the first time. What deductions can I claim and what should I know?" },
  { domain: "financial", label: "Debt Strategy", prompt: "I have credit card debt and a student loan. What's the best strategy to pay them off?" },
  { domain: "medical", label: "Symptom Info", prompt: "I've been having headaches and fatigue for two weeks. What could this be and when should I see a doctor?" },
  { domain: "medical", label: "Medication Questions", prompt: "What questions should I ask my doctor when starting a new medication?" },
  { domain: "medical", label: "Wellness Tips", prompt: "What are the key components of a healthy lifestyle including diet, exercise, and sleep?" },
];

export default function NewQuery() {
  const router = useRouter();
  const { addToast } = useToast();
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [savedDraft, setSavedDraft] = useState(null);
  const [usage, setUsage] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push("/signin"); return; }
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a locally saved draft once on mount
        setSavedDraft(parsed);
        if (!content) {
          setContent(parsed.content || "");
          setSelectedDomain(parsed.domain || null);
        }
      } catch {}
    }
    authorizedFetch(`${API}/auth/usage`)
      .then(async (res) => { if (res.ok) setUsage(await res.json()); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (content) {
      const timer = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ content, domain: selectedDomain, savedAt: Date.now() }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [content, selectedDomain]);

  function restoreDraft() {
    if (savedDraft) {
      setContent(savedDraft.content || "");
      setSelectedDomain(savedDraft.domain || null);
      addToast("Draft restored", "info");
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setSavedDraft(null);
    setContent("");
    addToast("Draft cleared", "info");
  }

  function applyTemplate(t) {
    setContent(t.prompt);
    setSelectedDomain(t.domain);
    setShowTemplates(false);
    addToast(`Template applied: ${t.label}`, "info");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setShowUpgrade(false);
    try {
      const res = await authorizedFetch(`${API}/agents/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: selectedDomain, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          setShowUpgrade(true);
          setError(data.detail || "You've used your free questions. Upgrade to continue.");
          addToast(data.detail || "Free tier limit reached", "error");
          return;
        }
        if (res.status === 401) { addToast("Please sign in again", "error"); router.push("/signin"); return; }
        throw new Error(data.detail || "Query failed");
      }
      setResult(data);
      localStorage.removeItem(DRAFT_KEY);
      setSavedDraft(null);
      addToast("Query submitted successfully", "success");
      if (usage?.quota_limit != null) {
        setUsage((current) => current ? {
          ...current,
          total_queries: (current.total_queries || 0) + 1,
          queries_remaining: Math.max(0, (current.queries_remaining ?? current.quota_limit) - 1),
        } : current);
      }
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const freeQuotaLabel = usage?.quota_limit != null
    ? `${Math.max(0, (usage.quota_limit || 0) - (usage.total_queries || 0))} of ${usage.quota_limit} free questions left`
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-line">
        <a href="/dashboard" className="text-ink-2 hover:text-ink"><ArrowLeft className="w-5 h-5" /></a>
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-legal flex items-center justify-center shadow-md shadow-primary/25">
          <Bot className="w-4 h-4 text-white" />
        </span>
        <span className="font-bold tracking-tight">New Query</span>
        <div className="flex-1" />
        <ThemeToggle />
        {savedDraft && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><History className="w-3 h-3" /> Draft saved</span>
            <button onClick={restoreDraft} className="text-xs text-primary hover:text-primary-strong">Restore</button>
            <button onClick={clearDraft} className="text-xs text-ink-3 hover:text-rose-500 dark:hover:text-rose-400"><Trash2 className="w-3 h-3" /></button>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-semibold">Ask a Professional Question</h1>
            <p className="text-ink-2 mt-1">Get AI-powered guidance on legal, financial, or medical topics.</p>
            {freeQuotaLabel && (
              <p className="text-sm text-primary mt-2">{freeQuotaLabel}</p>
            )}
          </div>
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface border border-line text-sm font-medium transition-all">
            <Sparkles className="w-4 h-4 text-accent" /> Templates
          </button>
        </div>

        {showTemplates && (
          <div className="mb-6 bg-surface border border-line rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Quick Templates</h3>
              <button onClick={() => setShowTemplates(false)} className="text-xs text-ink-3 hover:text-ink">Close</button>
            </div>
            <div className="grid md:grid-cols-3 gap-2">
              {TEMPLATES.map((t, i) => {
                const domain = DOMAINS.find((d) => d.id === t.domain);
                const Icon = domain?.icon || Bot;
                return (
                  <button key={i} onClick={() => applyTemplate(t)}
                    className="flex items-start gap-3 p-3 rounded-xl bg-surface-2/60 hover:bg-surface-2 border border-line text-left transition-all group">
                    <Icon className={`w-4 h-4 mt-0.5 ${domain?.text || "text-ink-2"}`} />
                    <div>
                      <p className="text-sm font-medium text-ink group-hover:text-ink transition-colors">{t.label}</p>
                      <p className="text-xs text-ink-3 mt-0.5 line-clamp-2">{t.prompt.substring(0, 60)}...</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          <button onClick={() => setSelectedDomain(null)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all shrink-0 ${selectedDomain === null ? "bg-primary/15 border-primary/30 text-primary" : "bg-surface border-line text-ink-2 hover:border-ink-3"}`}>
            <Bot className="w-4 h-4" /> Auto-Detect
          </button>
          {DOMAINS.map((d) => {
            const Icon = d.icon;
            const isSelected = selectedDomain === d.id;
            return (
              <button key={d.id} onClick={() => setSelectedDomain(d.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all shrink-0 ${isSelected ? `${d.bg} ${d.border} ${d.text}` : "bg-surface border-line text-ink-2 hover:border-ink-3"}`}>
                <Icon className="w-4 h-4" /> {d.expertLabel}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your question in detail. For example: 'I need to review a residential lease agreement I received from my landlord. What key clauses should I look out for?'"
            rows={6} className="w-full px-5 py-4 rounded-2xl bg-surface-2 border border-line text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-ink-3">{selectedDomain ? `Querying ${selectedDomain} agent` : "AI will detect the domain automatically"}</p>
              {content.length > 0 && <span className="text-xs text-ink-3">{content.length} chars</span>}
            </div>
            <button type="submit" disabled={loading || !content.trim()}
              className="flex items-center gap-2 bg-primary hover:bg-primary-strong disabled:opacity-50 px-6 py-3 rounded-xl font-medium transition-all">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? "Processing..." : "Submit"}
            </button>
          </div>
        </form>

        {error && <div className="mt-6 bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-sm p-4 rounded-xl">{error}</div>}

        {showUpgrade && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-primary">You&apos;ve used your 3 free questions</h2>
            <p className="text-sm text-ink-2">Your question is still on this page. Upgrade to Pro to send it and keep asking.</p>
            <a href="/pricing" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-strong px-5 py-2.5 rounded-xl text-sm font-medium">
              Upgrade to send this
            </a>
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-sm text-ink-2 flex-wrap">
              <DomainBadge domain={result.domain} />
              {result.complexity_score && <span>Complexity: {(result.complexity_score * 100).toFixed(0)}%</span>}
              {result.is_escalated && <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><TriangleAlert className="w-4 h-4" /> Escalated: {result.escalation_reason}</span>}
            </div>
            <div className="bg-surface border border-line rounded-2xl p-6">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{result.response}</div>
            </div>
            <a href={`/query/${result.query_id}`} className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-strong">
              View full conversation →
            </a>
          </div>
        )}
      </main>
    </div>
  );
}