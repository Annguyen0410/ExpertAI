"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Check, Loader, ShieldCheck, TriangleAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Pricing() {
  const router = useRouter();
  const { user, loading: authLoading, apiCall } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState("");
  const [billingAvailable, setBillingAvailable] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setBillingAvailable(null);
      return;
    }
    apiCall("/subscriptions/status")
      .then((data) => setBillingAvailable(Boolean(data.billing_available)))
      .catch(() => setBillingAvailable(false));
  }, [apiCall, user]);

  async function subscribe(tier) {
    if (!user) {
      router.push("/signin");
      return;
    }
    setCheckoutLoading(tier);
    setError("");
    try {
      const data = await apiCall(`/subscriptions/create-checkout?tier=${tier}`, { method: "POST" });
      if (!data?.url) throw new Error("Checkout could not be started.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || "Checkout is unavailable right now.");
    } finally {
      setCheckoutLoading("");
    }
  }

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      desc: "Try the core workflow before you commit.",
      features: ["3 queries per account", "Guidance across supported domains", "Conversation history", "Risk and escalation indicators"],
      tier: null,
    },
    {
      name: "Individual",
      price: "$19",
      period: "/month",
      desc: "For recurring professional-information questions.",
      features: ["Expanded query access", "Document workspace", "Visible AI decision trail", "Professional referral workflow"],
      tier: "b2c",
      featured: true,
    },
    {
      name: "Professional",
      price: "$99",
      period: "/month",
      desc: "For invited professional service providers.",
      features: ["Structured client intake", "Escalation queue", "Professional response workspace", "Operational analytics for authorized admins"],
      tier: "b2b",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2"><Bot className="w-6 h-6 text-indigo-400" /><span className="font-bold">ExpertAI</span></Link>
        <Link href={user ? "/dashboard" : "/signin"} className="text-sm text-slate-300 hover:text-white">{user ? "Dashboard" : "Sign in"}</Link>
      </nav>

      <main className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300 mb-3">Pricing</p>
            <h1 className="text-4xl font-bold mb-4">Clear plans. No invented outcomes.</h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Choose access that fits your workflow. Billing only opens when this deployment has a real Stripe configuration.</p>
          </div>

          {!authLoading && user && billingAvailable === false && (
            <div className="max-w-3xl mx-auto mb-8 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 flex gap-3 text-sm text-amber-100">
              <TriangleAlert className="w-5 h-5 shrink-0 text-amber-300" />
              <p>Online checkout is not configured for this deployment yet. Your current account and free access remain available.</p>
            </div>
          )}
          {error && <p role="alert" className="max-w-3xl mx-auto mb-8 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-200">{error}</p>}

          <div className="grid md:grid-cols-3 gap-7 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const active = plan.tier && user?.subscription_tier === plan.tier && user?.subscription_active;
              const disabled = !plan.tier || checkoutLoading || (Boolean(user) && billingAvailable === false) || active;
              return (
                <section key={plan.name} className={`rounded-3xl p-7 border ${plan.featured ? "bg-indigo-500/10 border-indigo-400/40 shadow-lg shadow-indigo-950/30" : "bg-slate-900 border-slate-800"}`}>
                  {plan.featured && <span className="inline-flex mb-4 rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold">Most selected</span>}
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-slate-400 min-h-10">{plan.desc}</p>
                  <div className="flex items-baseline gap-1 my-6"><span className="text-4xl font-bold">{plan.price}</span><span className="text-slate-400">{plan.period}</span></div>
                  <ul className="space-y-3 mb-8">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-slate-300"><Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />{feature}</li>)}</ul>
                  {plan.tier ? (
                    <button type="button" onClick={() => subscribe(plan.tier)} disabled={disabled} className={`w-full min-h-11 rounded-xl font-semibold transition-colors flex justify-center items-center gap-2 ${disabled ? "bg-slate-800 text-slate-500 cursor-not-allowed" : plan.featured ? "bg-indigo-600 hover:bg-indigo-500" : "bg-slate-800 hover:bg-slate-700"}`}>
                      {checkoutLoading === plan.tier && <Loader className="w-4 h-4 animate-spin" />}
                      {active ? "Current plan" : user ? "Continue to secure checkout" : "Sign in to subscribe"}
                    </button>
                  ) : <Link href={user ? "/query" : "/signup"} className="w-full min-h-11 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold flex items-center justify-center">{user ? "Ask a question" : "Create a free account"}</Link>}
                </section>
              );
            })}
          </div>

          <div className="mt-12 max-w-3xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm text-slate-400 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <p>AI guidance remains educational. High-risk matters are directed to human review rather than represented as professional advice.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
