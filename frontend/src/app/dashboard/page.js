"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot, Plus, Clock, TriangleAlert, CheckCircle, DollarSign,
  LogOut, Menu, X, Activity, Briefcase, Search, Bell, Settings
} from "lucide-react";
import { TableSkeleton } from "../../components/LoadingSkeleton";
import ThemeToggle from "../../components/ThemeToggle";
import DomainBadge from "../../components/DomainBadge";
import { domainMeta } from "../../lib/domains";
import { authorizedFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("token");
  return null;
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}

const statusIcons = { completed: CheckCircle, escalated: TriangleAlert, processing: Clock, pending: Clock };

export default function Dashboard() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [user, setUser] = useState(null);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [activation, setActivation] = useState(null);

  async function confirmCheckout(sessionId) {
    try {
      const res = await authorizedFetch(`${API}/subscriptions/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        const nextUser = { ...getStoredUser(), subscription_tier: data.subscription_tier, subscription_active: data.subscription_active };
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
        setActivation({ ok: true, message: "Your subscription is active. Enjoy your expanded access!" });
        refreshUser();
      } else {
        setActivation({ ok: false, message: "Could not confirm your subscription yet. The Stripe receipt should still arrive by email — check your billing settings shortly." });
      }
    } catch {
      setActivation({ ok: false, message: "Could not confirm your subscription right now. Check your billing settings shortly." });
    }
  }

  async function fetchQueries() {
    try {
      const res = await authorizedFetch(`${API}/agents/queries`);
      if (res.ok) {
        const data = await res.json();
        setQueries(data);
        // Derive notices from the user's real query data rather than polling
        // a non-existent notifications endpoint.
        setNotifications(data.filter((query) => query.is_escalated).slice(0, 5).map((query) => ({
          query_id: query.id,
          query_title: query.title,
          message: "Professional review has been recommended for this query.",
        })));
      }
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/signin"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rehydrate the cached profile once on mount
    setUser(getStoredUser());
    fetchQueries();
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success" && params.get("session_id")) {
      confirmCheckout(params.get("session_id"));
    }
  }, []);

  const filtered = queries.filter((q) => {
    if (search && !q.title?.toLowerCase().includes(search.toLowerCase()) && !q.domain?.toLowerCase().includes(search.toLowerCase())) return false;
    if (domainFilter !== "all" && q.domain !== domainFilter) return false;
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    return true;
  });

  function signOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-bg flex">
      <div className={`fixed inset-0 bg-black/50 z-20 md:hidden ${sidebarOpen ? "block" : "hidden"}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`fixed md:sticky top-0 left-0 z-30 h-screen w-64 bg-surface border-r border-line p-6 flex flex-col transform transition-transform md:transform-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-legal flex items-center justify-center shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
              <Bot className="w-4 h-4 text-white" />
            </span>
            <span className="font-bold tracking-tight">Expert<span className="text-primary">AI</span></span>
          </Link>
          <button className="md:hidden" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        <nav className="space-y-2 flex-1 overflow-y-auto">
          <Link href="/query" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-white font-medium shadow-lg shadow-primary/25"><Plus className="w-5 h-5" /> New Query</Link>
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-medium"><Bot className="w-5 h-5" /> My Queries</Link>
          <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"><Settings className="w-5 h-5" /> Settings</Link>
          <Link href="/pricing" className="flex items-center gap-3 px-4 py-3 rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"><DollarSign className="w-5 h-5" /> Subscription</Link>
          {(user?.role === "admin" || user?.role === "professional") && (
            <div className="pt-4 border-t border-line mt-4">
              <p className="text-xs text-ink-3 px-4 mb-2 uppercase tracking-wider">Operations</p>
              {user?.role === "admin" && (
                <Link href="/operations" className="flex items-center gap-3 px-4 py-3 rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"><Activity className="w-5 h-5" /> Live Dashboard</Link>
              )}
              {(user?.role === "professional" || user?.role === "admin") && (
                <Link href="/professional" className="flex items-center gap-3 px-4 py-3 rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"><Briefcase className="w-5 h-5" /> Professional Portal</Link>
              )}
            </div>
          )}
        </nav>
        <div className="pt-4 border-t border-line mt-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-2 border border-line mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">{user?.name?.[0] || "U"}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{user?.name || "User"}</p><p className="text-xs text-ink-3 truncate">{user?.email || ""}</p></div>
          </div>
          <div className="flex items-center justify-between px-4">
            <ThemeToggle />
            <button onClick={signOut} className="flex items-center gap-2 text-sm text-ink-3 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"><LogOut className="w-4 h-4" /> Sign Out</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button className="md:hidden mr-3" onClick={() => setSidebarOpen(true)}><Menu className="w-6 h-6" /></button>
            <h1 className="font-display text-2xl font-semibold">My Queries</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-xl bg-surface-2 border border-line hover:border-ink-3 transition-colors">
                <Bell className="w-5 h-5 text-ink-2" />
                {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-xs flex items-center justify-center font-medium text-white">{notifications.length}</span>}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-surface border border-line rounded-2xl shadow-2xl z-10 overflow-hidden">
                  <p className="text-xs text-ink-3 px-4 py-3 border-b border-line font-medium">NOTIFICATIONS</p>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-ink-3 text-center py-6">No notifications</p>
                  ) : notifications.map((n, i) => (
                    <Link key={i} href={`/query/${n.query_id}`} className="block px-4 py-3 hover:bg-surface-2 transition-colors border-b border-line last:border-0">
                      <p className="text-sm text-ink">{n.message}</p>
                      <p className="text-xs text-ink-3 mt-0.5">{n.query_title}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/query" className="flex items-center gap-2 bg-primary hover:bg-primary-strong px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
              <Plus className="w-4 h-4" /> New Query
            </Link>
          </div>
        </div>

        {activation && (
          <div className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${activation.ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300"}`}>
            {activation.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{activation.message}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-line text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
          </div>
          <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-surface-2 border border-line text-ink-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All Domains</option>
            <option value="legal">Legal</option>
            <option value="financial">Financial</option>
            <option value="medical">Medical</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-surface-2 border border-line text-ink-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="escalated">Escalated</option>
          </select>
        </div>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Bot className="w-16 h-16 text-ink-3/40 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{queries.length === 0 ? "No queries yet" : "No matching queries"}</h2>
            <p className="text-ink-2 mb-6">{queries.length === 0 ? "Start by asking a legal, financial, or medical question." : "Try different search terms or filters."}</p>
            <Link href="/query" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-strong px-6 py-3 rounded-xl font-medium transition-all"><Plus className="w-4 h-4" /> Ask Your First Question</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => {
              const meta = domainMeta(q.domain);
              const StatusIcon = statusIcons[q.status] || Clock;
              return (
                <Link key={q.id} href={`/query/${q.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-line hover:border-ink-3 transition-all group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink/5">
                  <div className={`w-10 h-10 rounded-xl ${meta?.bg || "bg-surface-2"} ${meta?.border || "border-line"} border flex items-center justify-center shrink-0`}>
                    {meta ? <meta.icon className={`w-5 h-5 ${meta.text}`} /> : <Bot className="w-5 h-5 text-ink-2" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{q.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ink-3">
                      <span className="capitalize">{q.domain}</span><span>·</span>
                      <span>{new Date(q.created_at).toLocaleDateString()}</span>
                      {q.complexity_score && <><span>·</span><span>Complexity: {(q.complexity_score * 100).toFixed(0)}%</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.is_escalated && <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full border border-amber-500/20">Escalated</span>}
                    <StatusIcon className={`w-5 h-5 ${q.status === "completed" ? "text-emerald-600 dark:text-emerald-400" : q.status === "escalated" ? "text-amber-600 dark:text-amber-400" : "text-ink-3"}`} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}