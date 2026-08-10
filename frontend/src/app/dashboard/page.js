"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Plus, Scale, DollarSign, Heart, Clock, TriangleAlert, CheckCircle,
  LogOut, Menu, X, Activity, Briefcase, Search, Bell, Settings, Filter
} from "lucide-react";
import { TableSkeleton } from "../../components/LoadingSkeleton";
import { authorizedFetch } from "../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("token");
  return null;
}

const domainIcons = { legal: Scale, financial: DollarSign, medical: Heart };
const domainColors = {
  legal: "text-blue-400 bg-blue-500/10",
  financial: "text-emerald-400 bg-emerald-500/10",
  medical: "text-rose-400 bg-rose-500/10",
};
const statusIcons = { completed: CheckCircle, escalated: TriangleAlert, processing: Clock, pending: Clock };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/signin"); return; }
    try { setUser(JSON.parse(localStorage.getItem("user") || "{}")); } catch {}
    fetchQueries();
  }, []);

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
    <div className="min-h-screen bg-slate-950 flex">
      <div className={`fixed inset-0 bg-black/50 z-20 md:hidden ${sidebarOpen ? "block" : "hidden"}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`fixed md:sticky top-0 left-0 z-30 h-screen w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col transform transition-transform md:transform-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2"><Bot className="w-6 h-6 text-indigo-400" /><span className="font-bold">ExpertAI</span></div>
          <button className="md:hidden" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        <nav className="space-y-2 flex-1 overflow-y-auto">
          <a href="/query" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-600/20 text-indigo-300 font-medium"><Plus className="w-5 h-5" /> New Query</a>
          <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"><Bot className="w-5 h-5" /> My Queries</a>
          <a href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"><Settings className="w-5 h-5" /> Settings</a>
          <a href="/pricing" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"><DollarSign className="w-5 h-5" /> Subscription</a>
          {(user?.role === "admin" || user?.role === "professional") && (
            <div className="pt-4 border-t border-slate-800 mt-4">
              <p className="text-xs text-slate-500 px-4 mb-2 uppercase tracking-wider">Operations</p>
              {user?.role === "admin" && (
                <a href="/operations" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"><Activity className="w-5 h-5" /> Live Dashboard</a>
              )}
              {(user?.role === "professional" || user?.role === "admin") && (
                <a href="/professional" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"><Briefcase className="w-5 h-5" /> Professional Portal</a>
              )}
            </div>
          )}
        </nav>
        <div className="pt-4 border-t border-slate-800 mt-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm font-medium">{user?.name?.[0] || "U"}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{user?.name || "User"}</p><p className="text-xs text-slate-500 truncate">{user?.email || ""}</p></div>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-400 transition-colors w-full px-4 py-2"><LogOut className="w-4 h-4" /> Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button className="md:hidden mr-3" onClick={() => setSidebarOpen(true)}><Menu className="w-6 h-6" /></button>
            <h1 className="text-2xl font-bold">My Queries</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
                <Bell className="w-5 h-5 text-slate-400" />
                {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-xs flex items-center justify-center font-medium">{notifications.length}</span>}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-10 overflow-hidden">
                  <p className="text-xs text-slate-500 px-4 py-3 border-b border-slate-800 font-medium">NOTIFICATIONS</p>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">No notifications</p>
                  ) : notifications.map((n, i) => (
                    <a key={i} href={`/query/${n.query_id}`} className="block px-4 py-3 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0">
                      <p className="text-sm text-slate-200">{n.message}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.query_title}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <a href="/query" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
              <Plus className="w-4 h-4" /> New Query
            </a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Domains</option>
            <option value="legal">Legal</option>
            <option value="financial">Financial</option>
            <option value="medical">Medical</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
            <Bot className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{queries.length === 0 ? "No queries yet" : "No matching queries"}</h2>
            <p className="text-slate-400 mb-6">{queries.length === 0 ? "Start by asking a legal, financial, or medical question." : "Try different search terms or filters."}</p>
            <a href="/query" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-medium transition-all"><Plus className="w-4 h-4" /> Ask Your First Question</a>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => {
              const Icon = domainIcons[q.domain] || Bot;
              const StatusIcon = statusIcons[q.status] || Clock;
              const colorClass = domainColors[q.domain] || "text-slate-400 bg-slate-500/10";
              return (
                <a key={q.id} href={`/query/${q.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all group">
                  <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center shrink-0`}><Icon className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{q.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="capitalize">{q.domain}</span><span>·</span>
                      <span>{new Date(q.created_at).toLocaleDateString()}</span>
                      {q.complexity_score && <><span>·</span><span>Complexity: {(q.complexity_score * 100).toFixed(0)}%</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.is_escalated && <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full">Escalated</span>}
                    <StatusIcon className={`w-5 h-5 ${q.status === "completed" ? "text-emerald-400" : q.status === "escalated" ? "text-amber-400" : "text-slate-500"}`} />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
