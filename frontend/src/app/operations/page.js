"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Activity, TrendingUp, DollarSign, Users, AlertTriangle,
  CheckCircle, Clock, BarChart3, FileText, Globe, Cpu,
  ArrowUpRight, ArrowDownRight, RefreshCw, LogOut
} from "lucide-react";
import { authorizedFetch } from "../../lib/api";
import ThemeToggle from "../../components/ThemeToggle";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("token");
  return null;
}

export default function OperationsDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push("/signin"); return; }
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored?.role !== "admin") {
        router.replace("/dashboard");
        return;
      }
    } catch {
      router.replace("/dashboard");
      return;
    }
    fetchAll();
  }, []);

  async function fetchAll() {
    setRefreshing(true);
    try {
      const [oRes, lRes, rRes, tRes] = await Promise.all([
        authorizedFetch(`${API}/analytics/overview`),
        authorizedFetch(`${API}/analytics/agent-logs?limit=20`),
        authorizedFetch(`${API}/analytics/revenue`),
        authorizedFetch(`${API}/analytics/testimonials`),
      ]);
      if (oRes.status === 403 || lRes.status === 403 || rRes.status === 403) {
        router.replace("/dashboard");
        return;
      }
      if (oRes.ok) setOverview(await oRes.json());
      if (lRes.ok) setAgentLogs(await lRes.json());
      if (rRes.ok) setRevenue(await rRes.json());
      if (tRes.ok) setTestimonials(await tRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setRefreshing(false);
  }

  function signOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between px-6 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-legal flex items-center justify-center shadow-lg shadow-primary/25">
            <Bot className="w-5 h-5 text-white" />
          </span>
          <span className="font-bold text-lg tracking-tight">ExpertAI <span className="text-primary">Operations</span></span>
          <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/20">AI-NATIVE</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <a href="/dashboard" className="text-sm text-ink-2 hover:text-ink">Dashboard</a>
          <ThemeToggle />
          <button onClick={signOut} className="text-sm text-ink-3 hover:text-rose-500 dark:hover:text-rose-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <MetricCard icon={Activity} label="Total Queries" value={overview?.total_queries || 0} />
          <MetricCard icon={Users} label="Total Users" value={overview?.total_users || 0} />
          <MetricCard icon={TrendingUp} label="AI Resolution" value={`${overview?.ai_resolution_rate || 0}%`} color="text-financial" />
          <MetricCard icon={AlertTriangle} label="Escalations" value={overview?.total_escalations || 0} color="text-amber-600 dark:text-amber-400" />
          <MetricCard icon={DollarSign} label="Revenue" value={`$${overview?.revenue_dollars || 0}`} color="text-financial" />
          <MetricCard icon={CheckCircle} label="Avg Rating" value={`${overview?.avg_feedback_rating || "—"}/5`} color="text-amber-600 dark:text-amber-400" />
        </div>

        {revenue && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-financial/15 to-financial/5 rounded-2xl border border-financial/25 p-5">
              <p className="text-xs text-financial uppercase tracking-wider mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-financial">${revenue.total_revenue_dollars}</p>
            </div>
            <div className="bg-gradient-to-br from-legal/15 to-legal/5 rounded-2xl border border-legal/25 p-5">
              <p className="text-xs text-legal uppercase tracking-wider mb-1">Projected MRR</p>
              <p className="text-3xl font-bold text-legal">${revenue.projected_mrr_dollars}</p>
            </div>
            <div className="bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl border border-primary/25 p-5">
              <p className="text-xs text-primary uppercase tracking-wider mb-1">Active B2C</p>
              <p className="text-3xl font-bold text-primary">{revenue.active_b2c}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500/15 to-amber-500/5 rounded-2xl border border-amber-500/25 p-5">
              <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Active B2B</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{revenue.active_b2b}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface rounded-2xl border border-line p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" /> Agent Execution Logs
              </h3>
              <span className="text-xs text-ink-3">Real-time AI decisions</span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {agentLogs.length === 0 ? (
                <p className="text-sm text-ink-3 text-center py-8">No agent executions yet. Submit a query to see AI decisions in action.</p>
              ) : agentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2/60 text-sm">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    log.decision?.startsWith("ESCALATE") ? "bg-amber-500" :
                    log.decision === "AI_RESOLVED" || log.decision === "AI_RESPONDED" ? "bg-emerald-500" : "bg-legal"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{log.agent_name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-2 border border-line text-ink-2">{log.action}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-3 mt-1">
                      <span className="text-primary font-mono">{log.decision}</span>
                      {log.confidence_score && <span>{(log.confidence_score * 100).toFixed(0)}% confidence</span>}
                      {log.execution_time_ms && <span>{log.execution_time_ms}ms</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Recent Revenue Events
              </h3>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {revenue?.events?.length === 0 ? (
                <p className="text-sm text-ink-3 text-center py-8">No revenue events yet. Subscribe to a plan to generate revenue.</p>
              ) : revenue?.events?.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-2/60 text-sm">
                  <div>
                    <span className="text-ink font-medium">{ev.event_type}</span>
                    {ev.description && <p className="text-xs text-ink-3">{ev.description}</p>}
                  </div>
                  <span className="text-financial font-mono font-semibold">+${ev.amount_dollars}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {testimonials.length > 0 && (
          <div className="bg-surface rounded-2xl border border-line p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" /> Customer Testimonials
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {testimonials.map((t) => (
                <div key={t.id} className="bg-surface-2/60 rounded-xl p-4 border border-line">
                  <div className="flex items-center gap-1 mb-2">
                    {[1,2,3,4,5].map((star) => (
                      <span key={star} className={`text-xs ${star <= t.rating ? "text-amber-500" : "text-ink-3"}`}>★</span>
                    ))}
                  </div>
                  <p className="text-sm text-ink mb-2">&ldquo;{(t.testimonial_text || "").substring(0, 150)}&rdquo;</p>
                  <p className="text-xs text-ink-3">{t.user_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex items-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        <span className="text-ink-2">Loading operations data...</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color = "text-ink" }) {
  return (
    <div className="bg-surface rounded-xl border border-line p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-ink-3" />
        <span className="text-xs text-ink-3">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}