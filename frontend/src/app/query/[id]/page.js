"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Bot, CheckCircle2, Cpu, Download, FileText, Heart, Loader2,
  Paperclip, Scale, Send, Star, TriangleAlert, Upload, WalletCards,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import ThemeToggle from "../../../components/ThemeToggle";
import DomainBadge from "../../../components/DomainBadge";
import { domainMeta } from "../../../lib/domains";

const domainIcons = { legal: Scale, financial: WalletCards, medical: Heart };

function formatTimestamp(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Just now";
}

export default function QueryDetail() {
  const router = useRouter();
  const params = useParams();
  const { token, loading: authLoading, apiCall } = useAuth();
  const [query, setQuery] = useState(null);
  const [messages, setMessages] = useState([]);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [input, setInput] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const chatEnd = useRef(null);

  const loadQuery = async () => {
    try {
      const data = await apiCall(`/agents/queries/${params.id}`);
      setQuery(data);
      setMessages(data.messages || []);
      setExecutionLogs(data.execution_logs || []);
      setDocuments(data.documents || []);
      setError("");
    } catch (err) {
      setQuery(null);
      setError(err.message || "We could not load this workspace.");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace("/signin");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the workspace after authentication resolves
    loadQuery();
  }, [apiCall, authLoading, params.id, router, token]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content }]);
    try {
      const data = await apiCall(`/agents/queries/${params.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((current) => [...current, { role: "assistant", content: data.content }]);
      await loadQuery();
    } catch (err) {
      const message = err.message || "Your follow-up could not be sent.";
      if (/upgrade|free plan|follow-up/i.test(message)) {
        setError(`${message} Upgrade at Pricing to continue.`);
      } else {
        setError(message);
      }
      setMessages((current) => current.slice(0, -1));
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  async function uploadDocument(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      await apiCall(`/documents/upload/${params.id}`, { method: "POST", body: form });
      await loadQuery();
    } catch (err) {
      setError(err.message || "The document could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function analyzeDocument(documentId) {
    setAnalyzingId(documentId);
    setError("");
    try {
      await apiCall(`/documents/${documentId}/analyze`, { method: "POST" });
      await loadQuery();
    } catch (err) {
      setError(err.message || "The document could not be analyzed.");
      await loadQuery();
    } finally {
      setAnalyzingId("");
    }
  }

  async function submitFeedback(score) {
    setRating(score);
    try {
      await apiCall(`/professional/queries/${params.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating: score, is_testimonial: false }),
      });
      setFeedbackSent(true);
    } catch (err) {
      setError(err.message || "Your rating could not be saved.");
    }
  }

  function exportConversation() {
    const disclaimer =
      "AI guidance is informational. For urgent, complex, or high-stakes situations, seek qualified professional help.";
    const header = [
      "ExpertAI Conversation Export",
      `Title: ${query?.title || "Untitled"}`,
      `Domain: ${query?.domain || "general"}`,
      `Exported: ${new Date().toISOString()}`,
      `Created: ${query?.created_at || "unknown"}`,
      `Escalated: ${query?.is_escalated ? "yes" : "no"}`,
      typeof query?.complexity_score === "number"
        ? `Complexity: ${Math.round(query.complexity_score * 100)}%`
        : null,
      `Disclaimer: ${disclaimer}`,
      "",
      "----------",
      "",
    ].filter(Boolean).join("\n");
    const body = messages.map((message) => `[${message.role.toUpperCase()}] ${message.content}`).join("\n\n---\n\n");
    const text = `${header}${body}\n\n----------\n${disclaimer}\n`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `expertai-${(query?.title || "conversation").slice(0, 30).replace(/\s+/g, "-")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (authLoading || pageLoading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="Loading workspace" /></div>;
  if (!query) return <main className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-6"><p className="text-ink">{error || "This workspace is unavailable."}</p><Link href="/dashboard" className="text-primary hover:text-primary-strong">Back to dashboard</Link></main>;

  const meta = domainMeta(query.domain);
  const Icon = domainIcons[query.domain] || Bot;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2" aria-label="Back to dashboard"><ArrowLeft className="w-5 h-5" /></Link>
          <div className={`w-9 h-9 rounded-xl border ${meta?.bg || "bg-surface-2"} ${meta?.border || "border-line"} flex items-center justify-center shrink-0`}>
            {meta ? <meta.icon className={`w-5 h-5 ${meta.text}`} /> : <Icon className="w-5 h-5 text-ink-2" />}
          </div>
          <div className="min-w-0 flex-1"><h1 className="font-semibold truncate">{query.title}</h1><p className="text-xs text-ink-3 capitalize">{query.domain} · {formatTimestamp(query.created_at)}</p></div>
          <ThemeToggle className="hidden sm:inline-flex" />
          <button type="button" onClick={exportConversation} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-xs text-ink-2 hover:bg-surface-2"><Download className="w-3.5 h-3.5" />Export</button>
          <button type="button" onClick={() => setShowLogs((value) => !value)} aria-expanded={showLogs} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs ${showLogs ? "border-primary/40 bg-primary/15 text-primary" : "border-line text-ink-2 hover:bg-surface-2"}`}><Cpu className="w-3.5 h-3.5" />Trace</button>
        </div>
      </header>

      {query.is_escalated && <div className="border-b border-amber-500/20 bg-amber-500/10"><div className="max-w-6xl mx-auto px-6 py-3 flex gap-3 text-sm text-amber-600 dark:text-amber-300"><TriangleAlert className="w-5 h-5 shrink-0 text-amber-500" /><p><strong>Professional review recommended.</strong> {query.escalation_reason || "This question needs human judgment before a tailored answer."}</p></div></div>}

      {showLogs && <section className="border-b border-line bg-surface/60"><div className="max-w-6xl mx-auto px-6 py-5"><h2 className="text-sm font-semibold flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" />Execution trace</h2><p className="text-xs text-ink-3 mt-1 mb-4">Agent → decision → action → result. Sensitive prompt content is not duplicated here.</p><ol className="space-y-3">{executionLogs.length ? executionLogs.map((log, index) => <li key={`${log.created_at}-${index}`} className="grid grid-cols-[auto_1fr] gap-3 text-sm"><span className={`mt-1.5 w-2 h-2 rounded-full ${log.status === "failed" ? "bg-rose-500" : log.status === "guarded" ? "bg-amber-500" : "bg-emerald-500"}`} /><div><p className="text-ink"><span className="font-medium text-primary">{log.agent_name}</span> <span className="text-ink-3">→</span> {log.action} <span className="text-ink-3">→</span> {log.decision}</p><p className="text-xs text-ink-3 mt-1">{formatTimestamp(log.created_at)}{log.execution_time_ms ? ` · ${log.execution_time_ms}ms` : ""}{typeof log.confidence_score === "number" ? ` · ${Math.round(log.confidence_score * 100)}% confidence` : ""}</p></div></li>) : <li className="text-sm text-ink-3">No execution events are available yet.</li>}</ol></div></section>}

      <main className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 px-4 sm:px-6 py-6">
        <section className="min-w-0 space-y-4">
          {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="space-y-4 min-h-[360px]">{messages.map((message, index) => <div key={`${message.created_at || "new"}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}><div className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${message.role === "user" ? "bg-primary text-white" : "bg-surface border border-line text-ink"}`}>{message.content}</div></div>)}{sending && <div className="flex items-center gap-2 text-sm text-ink-3"><Loader2 className="w-4 h-4 animate-spin" />Agent is preparing a response…</div>}<div ref={chatEnd} /></div>

          {query.status === "completed" && !feedbackSent && <div className="rounded-2xl border border-line bg-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"><p className="text-sm text-ink-2 flex-1">Was this response useful?</p><div className="flex gap-1">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} star rating`} onClick={() => submitFeedback(star)} className={star <= rating ? "text-amber-500" : "text-ink-3 hover:text-ink-2"}><Star className="w-5 h-5" fill={star <= rating ? "currentColor" : "none"} /></button>)}</div></div>}

          <form onSubmit={sendMessage} className="sticky bottom-4 rounded-2xl border border-line bg-surface/95 backdrop-blur p-3 flex gap-2"><label htmlFor="follow-up" className="sr-only">Ask a follow-up question</label><input id="follow-up" value={input} onChange={(event) => setInput(event.target.value)} maxLength={6000} placeholder="Ask a follow-up question…" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-ink-3" /><button type="submit" disabled={!input.trim() || sending} className="p-2.5 rounded-xl bg-primary hover:bg-primary-strong disabled:bg-surface-2 disabled:text-ink-3" aria-label="Send message">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button></form>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface p-4"><div className="flex items-start gap-3"><div className={`p-2 rounded-lg border ${meta?.bg || "bg-surface-2"} ${meta?.border || "border-line"}`}>{meta ? <meta.icon className={`w-4 h-4 ${meta.text}`} /> : <Icon className="w-4 h-4 text-ink-2" />}</div><div><h2 className="font-semibold text-sm capitalize">{meta?.expertLabel || `${query.domain} workspace`}</h2><p className="text-xs text-ink-3 mt-1">Complexity {typeof query.complexity_score === "number" ? `${Math.round(query.complexity_score * 100)}%` : "not scored"}</p></div></div><div className="mt-3"><DomainBadge domain={query.domain} label={query.domain} iconClassName="w-3.5 h-3.5" /></div></section>
          <section className="rounded-2xl border border-line bg-surface p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-sm">Documents</h2><p className="text-xs text-ink-3 mt-1">PDF, text, PNG, JPEG, or GIF · 10 MB max</p></div><button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="p-2 rounded-lg bg-primary hover:bg-primary-strong disabled:bg-surface-2" aria-label="Upload document">{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</button><input ref={fileInput} type="file" className="hidden" accept=".pdf,.txt,image/png,image/jpeg,image/gif" onChange={uploadDocument} /></div><div className="mt-4 space-y-3">{documents.length ? documents.map((document) => <article key={document.id} className="rounded-xl border border-line bg-bg/60 p-3"><div className="flex gap-2"><FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="text-xs font-medium truncate">{document.filename}</p><p className="text-xs text-ink-3 mt-1 capitalize">{document.processing_status}{document.size_bytes ? ` · ${Math.ceil(document.size_bytes / 1024)} KB` : ""}</p></div></div>{document.analysis_summary && <p className="mt-3 text-xs leading-relaxed text-ink-2 whitespace-pre-wrap">{document.analysis_summary}</p>}{!document.analysis_summary && <button type="button" onClick={() => analyzeDocument(document.id)} disabled={Boolean(analyzingId)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-strong disabled:text-ink-3">{analyzingId === document.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}{analyzingId === document.id ? "Analyzing…" : "Analyze document"}</button>}</article>) : <p className="text-xs text-ink-3 py-3">Attach a supporting document to keep it connected to this query.</p>}</div></section>
          <section className="rounded-2xl border border-line bg-surface p-4 text-xs text-ink-2"><div className="flex gap-2"><TriangleAlert className="w-4 h-4 text-amber-500 shrink-0" /><p>AI guidance is informational. For urgent, complex, or high-stakes situations, seek qualified professional help.</p></div></section>
        </aside>
      </main>
    </div>
  );
}