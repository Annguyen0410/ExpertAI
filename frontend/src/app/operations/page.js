"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Activity, TrendingUp, DollarSign, Users, AlertTriangle,
  CheckCircle, Clock, BarChart3, FileText, Globe, Cpu,
  ArrowUpRight, ArrowDownRight, RefreshCw, LogOut
} from "lucide-react";

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
    fetchAll();
  }, []);

  async function fetchAll() {
    setRefreshing(true);
    const headers = { Authorization: `Bearer ${getToken()}` };
    try {
      const [oRes, lRes, rRes, tRes] = await Promise.all([
        fetch(`${API}/analytics/overview`, { headers }),
        fetch(`${API}/analytics/agent-logs?limit=20`, { headers }),
        fetch(`${API}/analytics/revenue`, { headers }),
        fetch(`${API}/analytics/testimonials`, { headers }),
      ]);
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
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Bot className="w-7 h-7 text-indigo-400" />
          <span className="font-bold text-lg">ExpertAI Operations</span>
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">AI-NATIVE</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <a href="/dashboard" className="text-sm text-slate-400 hover:text-white">Dashboard</a>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-red-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <MetricCard icon={Activity} label="Total Queries" value={overview?.total_queries || 0} />
          <MetricCard icon={Users} label="Total Users" value={overview?.total_users || 0} />
          <MetricCard icon={TrendingUp} label="AI Resolution" value={`${overview?.ai_resolution_rate || 0}%`} color="text-emerald-400" />
          <MetricCard icon={AlertTriangle} label="Escalations" value={overview?.total_escalations || 0} color="text-amber-400" />
          <MetricCard icon={DollarSign} label="Revenue" value={`$${overview?.revenue_dollars || 0}`} color="text-emerald-400" />
          <MetricCard icon={CheckCircle} label="Avg Rating" value={`${overview?.avg_feedback_rating || "—"}/5`} color="text-amber-400" />
        </div>

        {revenue && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-2xl border border-emerald-500/20 p-5">
              <p className="text-xs text-emerald-400/70 uppercase tracking-wider mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-emerald-400">${revenue.total_revenue_dollars}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl border border-blue-500/20 p-5">
              <p className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">Projected MRR</p>
              <p className="text-3xl font-bold text-blue-400">${revenue.projected_mrr_dollars}</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 rounded-2xl border border-indigo-500/20 p-5">
              <p className="text-xs text-indigo-400/70 uppercase tracking-wider mb-1">Active B2C</p>
              <p className="text-3xl font-bold text-indigo-400">{revenue.active_b2c}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-2xl border border-amber-500/20 p-5">
              <p className="text-xs text-amber-400/70 uppercase tracking-wider mb-1">Active B2B</p>
              <p className="text-3xl font-bold text-amber-400">{revenue.active_b2b}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" /> Agent Execution Logs
              </h3>
              <span className="text-xs text-slate-500">Real-time AI decisions</span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {agentLogs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No agent executions yet. Submit a query to see AI decisions in action.</p>
              ) : agentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 text-sm">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    log.decision?.startsWith("ESCALATE") ? "bg-amber-400" :
                    log.decision === "AI_RESOLVED" || log.decision === "AI_RESPONDED" ? "bg-emerald-400" : "bg-blue-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{log.agent_name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{log.action}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="text-indigo-400/80 font-mono">{log.decision}</span>
                      {log.confidence_score && <span>{(log.confidence_score * 100).toFixed(0)}% confidence</span>}
                      {log.execution_time_ms && <span>{log.execution_time_ms}ms</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Recent Revenue Events
              </h3>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {revenue?.events?.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No revenue events yet. Subscribe to a plan to generate revenue.</p>
              ) : revenue?.events?.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 text-sm">
                  <div>
                    <span className="text-slate-200 font-medium">{ev.event_type}</span>
                    {ev.description && <p className="text-xs text-slate-500">{ev.description}</p>}
                  </div>
                  <span className="text-emerald-400 font-mono font-semibold">+${ev.amount_dollars}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {testimonials.length > 0 && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-indigo-400" /> Customer Testimonials
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {testimonials.map((t) => (
                <div key={t.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-1 mb-2">
                    {[1,2,3,4,5].map((star) => (
                      <span key={star} className={`text-xs ${star <= t.rating ? "text-amber-400" : "text-slate-600"}`}>★</span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-300 mb-2">&ldquo;{(t.testimonial_text || "").substring(0, 150)}&rdquo;</p>
                  <p className="text-xs text-slate-500">{t.user_name}</p>
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
        <span className="text-slate-400">Loading operations data...</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color = "text-slate-100" }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
