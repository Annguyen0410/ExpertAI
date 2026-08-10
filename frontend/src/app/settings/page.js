"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, ArrowLeft, User, Lock, TrendingUp, DollarSign, Save, Loader } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { authorizedFetch } from "../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("token");
  return null;
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}

export default function Settings() {
  const router = useRouter();
  const { addToast } = useToast();
  const [tab, setTab] = useState("profile");
  const [user, setUser] = useState(getStoredUser());
  const [name, setName] = useState(user.name || "");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [usage, setUsage] = useState(null);
  const [billing, setBilling] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push("/signin"); return; }
    fetchUser();
    fetchUsage();
    fetchBilling();
  }, []);

  async function fetchUser() {
    try {
      const res = await authorizedFetch(`${API}/auth/me`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setName(data.name || "");
      }
    } catch {}
  }

  async function fetchUsage() {
    try {
      const res = await authorizedFetch(`${API}/auth/usage`);
      if (res.ok) setUsage(await res.json());
    } catch {}
  }

  async function fetchBilling() {
    try {
      const res = await authorizedFetch(`${API}/auth/billing`);
      if (res.ok) setBilling(await res.json());
    } catch {}
  }

  async function updateProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authorizedFetch(`${API}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        addToast("Profile updated", "success");
        const stored = getStoredUser();
        stored.name = name;
        localStorage.setItem("user", JSON.stringify(stored));
      }
    } catch { addToast("Failed to update profile", "error"); }
    setSaving(false);
  }

  async function changePassword(e) {
    e.preventDefault();
    if (newPw.length < 6) { addToast("Password must be at least 6 characters", "error"); return; }
    setSaving(true);
    try {
      const res = await authorizedFetch(`${API}/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: oldPw, new_password: newPw }),
      });
      if (res.ok) { addToast("Password changed", "success"); setOldPw(""); setNewPw(""); }
      else { const d = await res.json(); addToast(d.detail || "Failed", "error"); }
    } catch { addToast("Failed to change password", "error"); }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-slate-800">
        <a href="/dashboard" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></a>
        <Bot className="w-6 h-6 text-indigo-400" />
        <span className="font-bold">Settings</span>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-8">
          {[
            { id: "profile", label: "Profile", icon: User },
            { id: "password", label: "Password", icon: Lock },
            { id: "usage", label: "Usage", icon: TrendingUp },
            { id: "billing", label: "Billing", icon: DollarSign },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "profile" && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><User className="w-5 h-5 text-indigo-400" /> Profile</h2>
            <form onSubmit={updateProfile} className="space-y-4 max-w-md">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Email</label>
                <input type="email" value={user.email || ""} disabled className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Role</label>
                <input type="text" value={user.role || ""} disabled className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 cursor-not-allowed capitalize" />
              </div>
              <button type="submit" disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-6 py-3 rounded-xl font-medium transition-all">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        )}

        {tab === "password" && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Lock className="w-5 h-5 text-indigo-400" /> Change Password</h2>
            <form onSubmit={changePassword} className="space-y-4 max-w-md">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Current Password</label>
                <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">New Password</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button type="submit" disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-6 py-3 rounded-xl font-medium transition-all">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Changing..." : "Change Password"}
              </button>
            </form>
          </div>
        )}

        {tab === "usage" && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-400" /> My Usage</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-indigo-400">{usage?.total_queries || 0}</p>
                  <p className="text-xs text-slate-500">Total Queries</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-400">{usage?.completed || 0}</p>
                  <p className="text-xs text-slate-500">Completed</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-amber-400">{usage?.escalated || 0}</p>
                  <p className="text-xs text-slate-500">Escalated</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-cyan-400">{usage?.queries_remaining !== null ? usage.queries_remaining : "∞"}</p>
                  <p className="text-xs text-slate-500">Queries Left</p>
                </div>
              </div>
              {usage?.queries_by_domain && Object.keys(usage.queries_by_domain).length > 0 && (
                <div>
                  <p className="text-sm text-slate-400 mb-3">By Domain</p>
                  <div className="space-y-2">
                    {Object.entries(usage.queries_by_domain).map(([domain, count]) => (
                      <div key={domain} className="flex items-center gap-3">
                        <span className="text-sm capitalize w-24 text-slate-300">{domain}</span>
                        <div className="flex-1 bg-slate-800 rounded-full h-2">
                          <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(count / usage.total_queries) * 100}%` }} />
                        </div>
                        <span className="text-sm text-slate-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "billing" && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><DollarSign className="w-5 h-5 text-indigo-400" /> Billing History</h2>
            <div className="flex items-center gap-3 mb-6 p-4 bg-slate-800/50 rounded-xl">
              <span className="text-sm text-slate-400">Current plan:</span>
              <span className="font-semibold capitalize">{billing?.subscription_tier || "free"}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${billing?.subscription_active ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700 text-slate-400"}`}>
                {billing?.subscription_active ? "Active" : "Inactive"}
              </span>
              <a href="/pricing" className="text-xs text-indigo-400 hover:text-indigo-300 ml-auto">Change plan →</a>
            </div>
            {billing?.events?.length > 0 ? (
              <div className="space-y-2">
                {billing.events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 text-sm">
                    <div>
                      <span className="text-slate-200 capitalize">{ev.event_type?.replace(/_/g, " ")}</span>
                      {ev.description && <p className="text-xs text-slate-500">{ev.description}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-mono font-semibold">${ev.amount_dollars}</span>
                      <p className="text-xs text-slate-500">{new Date(ev.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                <p>No billing history yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
