"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Briefcase, Clock, CheckCircle, AlertTriangle,
  ArrowRight, Send, User, FileText, RefreshCw, LogOut, Star
} from "lucide-react";
import { authorizedFetch } from "../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("token");
  return null;
}

export default function ProfessionalDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
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
      setUser(u);
    } catch {}
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [eRes, aRes, sRes] = await Promise.all([
        authorizedFetch(`${API}/professional/escalations`),
        authorizedFetch(`${API}/professional/escalations/available`),
        authorizedFetch(`${API}/professional/escalations/stats`),
      ]);
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-indigo-400" />
          <span className="font-bold">ExpertAI Professional</span>
          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Expert Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="text-sm text-slate-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
          <a href="/dashboard" className="text-sm text-slate-400 hover:text-white">Dashboard</a>
          <a href="/operations" className="text-sm text-slate-400 hover:text-white">Operations</a>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-red-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <p className="text-xs text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <p className="text-xs text-slate-500">Resolved</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.resolved}</p>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <p className="text-xs text-slate-500">Total Cases</p>
              <p className="text-2xl font-bold text-indigo-400">{stats.total}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("available")}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === "available" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
            Available ({available.length})
          </button>
          <button onClick={() => setTab("my")}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === "my" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
            My Cases ({escalations.length})
          </button>
        </div>

        {tab === "available" && (
          <div className="space-y-3">
            {available.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400/50" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No pending escalations available.</p>
              </div>
            ) : available.map((esc) => (
              <div key={esc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{esc.query_title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">{esc.domain}</span>
                      <span>{new Date(esc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => claimEscalation(esc.id)}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-sm font-medium transition-all">
                    Claim <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-slate-400 mb-2"><span className="text-slate-300">Reason:</span> {esc.reason}</p>
                {esc.case_summary && (
                  <details className="text-sm">
                    <summary className="text-indigo-400 cursor-pointer hover:text-indigo-300">View case summary</summary>
                    <p className="text-slate-400 mt-2 whitespace-pre-wrap">{esc.case_summary}</p>
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
                  className={`bg-slate-900 border rounded-2xl p-4 cursor-pointer transition-all ${
                    selectedEsc?.id === esc.id ? "border-indigo-500/50" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm truncate">{esc.query_title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      esc.status === "resolved" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
                    }`}>{esc.status}</span>
                  </div>
                  <p className="text-xs text-slate-500">Client: {esc.client_name || "Anonymous"}</p>
                </div>
              ))}
            </div>

            <div>
              {selectedEsc ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h3 className="font-semibold mb-1">{selectedEsc.query_title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                    <span className="capitalize px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">{selectedEsc.domain}</span>
                    <span>Client: {selectedEsc.client_name}</span>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                    <p className="text-xs text-slate-500 mb-1">Client Query</p>
                    <p className="text-sm text-slate-300">{selectedEsc.query_content}</p>
                  </div>

                  {selectedEsc.case_summary && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-4">
                      <p className="text-xs text-amber-400 mb-1">AI Case Summary</p>
                      <p className="text-sm text-slate-300">{selectedEsc.case_summary}</p>
                    </div>
                  )}

                  {selectedEsc.status === "resolved" && selectedEsc.professional_response ? (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                      <p className="text-xs text-emerald-400 mb-1">Your Response</p>
                      <p className="text-sm text-slate-300">{selectedEsc.professional_response}</p>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder="Write your professional response..."
                        rows={5}
                        className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3"
                      />
                      <button
                        onClick={respondToEscalation}
                        disabled={sending || !response.trim()}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                      >
                        {sending ? "Sending..." : <><Send className="w-4 h-4" /> Submit Response</>}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                  <User className="w-12 h-12 mx-auto mb-3 text-slate-700" />
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
