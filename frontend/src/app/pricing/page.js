"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader, ShieldCheck, TriangleAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";

export default function Pricing() {
  const router = useRouter();
  const { user, loading: authLoading, apiCall } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState("");
  const [billingAvailable, setBillingAvailable] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
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
    <div className="min-h-screen bg-bg">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-line">
        <Logo />
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href={user ? "/dashboard" : "/signin"} className="text-sm text-ink-2 hover:text-ink">{user ? "Dashboard" : "Sign in"}</Link>
        </div>
      </nav>

      <main className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary mb-3">Pricing</p>
            <h1 className="font-display text-4xl font-semibold mb-4">Clear plans. No invented outcomes.</h1>
            <p className="text-ink-2 text-lg max-w-2xl mx-auto">Choose access that fits your workflow. Cancel anytime. Secure payment via Stripe.</p>
          </div>

          {!authLoading && user && billingAvailable === false && (
            <div className="max-w-3xl mx-auto mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex gap-3 text-sm text-amber-600 dark:text-amber-300">
              <TriangleAlert className="w-5 h-5 shrink-0 text-amber-500" />
              <p>Online checkout is not configured for this deployment yet. Your current account and free access remain available.</p>
            </div>
          )}
          {error && <p role="alert" className="max-w-3xl mx-auto mb-8 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="grid md:grid-cols-3 gap-7 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const active = plan.tier && user?.subscription_tier === plan.tier && user?.subscription_active;
              const disabled = !plan.tier || checkoutLoading || (Boolean(user) && billingAvailable === false) || active;
              return (
                <section key={plan.name} className={`rounded-3xl p-7 border bg-surface ${plan.featured ? "border-primary/40 shadow-lg shadow-primary/10" : "border-line"}`}>
                  {plan.featured && <span className="inline-flex mb-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Most selected</span>}
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-ink-2 min-h-10">{plan.desc}</p>
                  <div className="flex items-baseline gap-1 my-6"><span className="text-4xl font-bold">{plan.price}</span><span className="text-ink-3">{plan.period}</span></div>
                  <ul className="space-y-3 mb-8">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-ink-2"><Check className="w-4 h-4 mt-0.5 text-financial shrink-0" />{feature}</li>)}</ul>
                  {plan.tier ? (
                    <button type="button" onClick={() => subscribe(plan.tier)} disabled={disabled} className={`w-full min-h-11 rounded-xl font-semibold transition-colors flex justify-center items-center gap-2 ${disabled ? "bg-surface-2 text-ink-3 cursor-not-allowed border border-line" : plan.featured ? "bg-primary hover:bg-primary-strong" : "bg-surface-2 hover:bg-surface border border-line text-ink"}`}>
                      {checkoutLoading === plan.tier && <Loader className="w-4 h-4 animate-spin" />}
                      {active ? "Current plan" : user ? "Continue to secure checkout" : "Sign in to subscribe"}
                    </button>
                  ) : <Link href={user ? "/query" : "/signup"} className="w-full min-h-11 rounded-xl bg-surface-2 hover:bg-surface border border-line font-semibold flex items-center justify-center text-ink">{user ? "Ask a question" : "Create a free account"}</Link>}
                </section>
              );
            })}
          </div>

          <div className="mt-12 max-w-3xl mx-auto rounded-2xl border border-line bg-surface/60 px-5 py-4 text-sm text-ink-2 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-financial shrink-0" />
            <p>AI guidance remains educational. High-risk matters are directed to human review rather than represented as professional advice.</p>
          </div>
        </div>
      </main>
    </div>
  );
}