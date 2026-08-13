"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Shield, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import ThemeToggle from "../../components/ThemeToggle";

export default function SignUpPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const toast = useToast();
  const showToast = toast?.addToast;
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "individual" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get("email") || "").trim().toLowerCase();
    const fromStorage = (localStorage.getItem("expertai_signup_email") || "").trim().toLowerCase();
    const prefill = fromQuery || fromStorage;
    if (prefill) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill the email from the signup entry URL on mount
      setForm((current) => (current.email ? current : { ...current, email: prefill }));
      localStorage.removeItem("expertai_signup_email");
    }
  }, []);

  function validatePassword(password) {
    if (password.length < 12) return "Password must be at least 12 characters";
    if (password.length > 128) return "Password must be less than 128 characters";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
    if (!/\d/.test(password)) return "Password must contain at least one number";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      showToast?.(passwordError, "error");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signup(form.email.trim().toLowerCase(), form.password, form.name.trim());
      showToast?.("Account created successfully!", "success");
      router.push("/dashboard");
    } catch (err) {
      const message = err?.message || "Could not create your account.";
      setError(message);
      showToast?.(message, "error");
    } finally {
      setLoading(false);
    }
  }

  const existingAccount = /already exists/i.test(error);

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-legal/10 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-blob" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-legal/10 blur-3xl pointer-events-none animate-blob" style={{ animationDelay: "-9s" }} />
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8 animate-fade-up">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-legal shadow-lg shadow-primary/25 mb-3 animate-float">
            <Bot className="w-6 h-6 text-white" />
          </span>
          <h1 className="font-display text-2xl font-semibold">Create your account</h1>
          <p className="text-ink-2 text-sm mt-1">Start with a free tier, no credit card needed</p>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-8 shadow-xl shadow-ink/5 animate-fade-up delay-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                <p>{error}</p>
                {existingAccount && (
                  <p className="mt-2">
                    <Link href="/signin" className="text-primary hover:underline">
                      Sign in instead?
                    </Link>
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm text-ink-2 mb-1 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 w-5 h-5" />
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-10 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="John Doe"
                  maxLength={100}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-ink-2 mb-1 block">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-sm text-ink-2 mb-1 block">Password</label>
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="At least 12 characters with upper, lower, number"
              />
              <p className="text-xs text-ink-3 mt-1">Must be 12+ chars with uppercase, lowercase, and number</p>
            </div>
            <div>
              <label className="text-sm text-ink-2 mb-1 block">I am a...</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="individual">Individual seeking guidance</option>
                <option value="professional">Professional (Lawyer/CPA/Doctor)</option>
              </select>
              {form.role === "professional" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Professional accounts require an invitation. You can create an individual account now and upgrade later.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-strong disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-ink-2 mt-6">
          Already have an account?{" "}
          <Link href="/signin" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
        <p className="text-center text-xs text-ink-3 mt-4">
          <Shield className="w-3 h-3 inline-block mr-1" /> Protected by rate limiting & encryption
        </p>
      </div>
    </div>
  );
}