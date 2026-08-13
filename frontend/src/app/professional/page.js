"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Briefcase, Clock, CheckCircle, AlertTriangle,
  ArrowRight, Send, User, FileText, RefreshCw, LogOut, Star
} from "lucide-react";
import { authorizedFetch } from "../../lib/api";
import ThemeToggle from "../../components/ThemeToggle";
import DomainBadge from "../../components/DomainBadge";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("token");
  return null;
}

export default function ProfessionalDashboard() {
  const router = useRouter();
  const [escalations, setEscalations] = useState([]);
  const [available, setAvailable] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEsc, setSelectedEsc] = useState(null);
  const [response, setResponse] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState("available");

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/signin"); return; }
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      if (u?.role !== "professional" && u?.role !== "admin") {
        router.replace("/dashboard");
        return;
      }
    } catch {
      router.replace("/dashboard");
      return;
    }
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [eRes, aRes, sRes] = await Promise.all([
        authorizedFetch(`${API}/professional/escalations`),
        authorizedFetch(`${API}/professional/escalations/available`),
        authorizedFetch(`${API}/professional/escalations/stats`),
      ]);
      if (eRes.status === 403 || aRes.status === 403 || sRes.status === 403) {
        router.replace("/dashboard");
        return;
      }
      if (eRes.ok) setEscalations(await eRes.json());
      if (aRes.ok) setAvailable(await aRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function claimEscalation(id) {
    try {
      const res = await authorizedFetch(`${API}/professional/escalations/${id}/claim`, {
        method: "POST",
      });
      if (res.ok) fetchData();
    } catch (e) { console.error(e); }
  }

  async function respondToEscalation() {
    if (!response.trim() || !selectedEsc) return;
    setSending(true);
    try {
      await authorizedFetch(`${API}/professional/escalations/${selectedEsc.id}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ professional_response: response }),
      });
      setResponse("");
      setSelectedEsc(null);
      fetchData();
    } catch (e) { console.error(e); }
    setSending(false);
  }

  function signOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  }

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center text-ink-2">Loading...</div>;

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between px-6 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-financial to-legal flex items-center justify-center shadow-lg shadow-financial/25">
            <Briefcase className="w-5 h-5 text-white" />
          </span>
          <span className="font-bold tracking-tight">ExpertAI <span className="text-primary">Professional</span></span>
          <span className="text-xs bg-financial/15 text-financial px-2 py-0.5 rounded-full border border-financial/25">Expert Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="text-sm text-ink-2 hover:text-ink">
            <RefreshCw className="w-4 h-4" />
          </button>
          <a href="/dashboard" className="text-sm text-ink-2 hover:text-ink">Dashboard</a>
          <a href="/operations" className="text-sm text-ink-2 hover:text-ink">Operations</a>
          <ThemeToggle />
          <button onClick={signOut} className="text-sm text-ink-3 hover:text-rose-500 dark:hover:text-rose-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-surface rounded-xl border border-line p-4">
              <p className="text-xs text-ink-3">Pending</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
            </div>
            <div className="bg-surface rounded-xl border border-line p-4">
              <p className="text-xs text-ink-3">Resolved</p>
              <p className="text-2xl font-bold text-financial">{stats.resolved}</p>
            </div>
            <div className="bg-surface rounded-xl border border-line p-4">
              <p className="text-xs text-ink-3">Total Cases</p>
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("available")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === "available" ? "bg-primary text-white" : "bg-surface-2 border border-line text-ink-2 hover:text-ink"}`}>
            Available ({available.length})
          </button>
          <button onClick={() => setTab("my")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === "my" ? "bg-primary text-white" : "bg-surface-2 border border-line text-ink-2 hover:text-ink"}`}>
            My Cases ({escalations.length})
          </button>
        </div>

        {tab === "available" && (
          <div className="space-y-3">
            {available.length === 0 ? (
              <div className="text-center py-16 text-ink-3">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-financial/60" />
                <p className="font-medium text-ink">All caught up!</p>
                <p className="text-sm">No pending escalations available.</p>
              </div>
            ) : available.map((esc) => (
              <div key={esc.id} className="bg-surface border border-line rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{esc.query_title}</h3>
                    <div className="flex items-center gap-3 text-xs text-ink-3 mt-1">
                      <DomainBadge domain={esc.domain} iconClassName="w-3.5 h-3.5" />
                      <span>{new Date(esc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => claimEscalation(esc.id)}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-strong px-4 py-2 rounded-xl text-sm font-medium transition-all">
                    Claim <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-ink-2 mb-2"><span className="text-ink">Reason:</span> {esc.reason}</p>
                {esc.case_summary && (
                  <details className="text-sm">
                    <summary className="text-primary cursor-pointer hover:text-primary-strong">View case summary</summary>
                    <p className="text-ink-2 mt-2 whitespace-pre-wrap">{esc.case_summary}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "my" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {escalations.map((esc) => (
                <div
                  key={esc.id}
                  onClick={() => setSelectedEsc(esc)}
                  className={`bg-surface border rounded-2xl p-4 cursor-pointer transition-all ${
                    selectedEsc?.id === esc.id ? "border-primary/50" : "border-line hover:border-ink-3"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm truncate">{esc.query_title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      esc.status === "resolved" ? "bg-financial/10 text-financial border-financial/25" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                    }`}>{esc.status}</span>
                  </div>
                  <p className="text-xs text-ink-3">Client: {esc.client_name || "Anonymous"}</p>
                </div>
              ))}
            </div>

            <div>
              {selectedEsc ? (
                <div className="bg-surface border border-line rounded-2xl p-5">
                  <h3 className="font-semibold mb-1">{selectedEsc.query_title}</h3>
                  <div className="flex items-center gap-2 text-xs text-ink-3 mb-4">
                    <DomainBadge domain={selectedEsc.domain} iconClassName="w-3.5 h-3.5" />
                    <span>Client: {selectedEsc.client_name}</span>
                  </div>

                  <div className="bg-surface-2/60 rounded-xl p-4 mb-4 border border-line">
                    <p className="text-xs text-ink-3 mb-1">Client Query</p>
                    <p className="text-sm text-ink">{selectedEsc.query_content}</p>
                  </div>

                  {selectedEsc.case_summary && (
                    <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4 mb-4">
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">AI Case Summary</p>
                      <p className="text-sm text-ink">{selectedEsc.case_summary}</p>
                    </div>
                  )}

                  {selectedEsc.status === "resolved" && selectedEsc.professional_response ? (
                    <div className="bg-financial/5 border border-financial/25 rounded-xl p-4">
                      <p className="text-xs text-financial mb-1">Your Response</p>
                      <p className="text-sm text-ink">{selectedEsc.professional_response}</p>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder="Write your professional response..."
                        rows={5}
                        className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none mb-3"
                      />
                      <button
                        onClick={respondToEscalation}
                        disabled={sending || !response.trim()}
                        className="flex items-center gap-2 bg-primary hover:bg-primary-strong disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                      >
                        {sending ? "Sending..." : <><Send className="w-4 h-4" /> Submit Response</>}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-ink-3 bg-surface rounded-2xl border border-line">
                  <User className="w-12 h-12 mx-auto mb-3 text-ink-3/50" />
                  <p>Select a case to respond</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}