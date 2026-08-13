"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import ThemeToggle from "../../components/ThemeToggle";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const toast = useToast();
  const showToast = toast?.addToast;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await forgotPassword(email.trim().toLowerCase());
      const nextMessage = data?.message || "If an account exists for that email, password reset instructions have been sent.";
      setMessage(nextMessage);
      showToast?.(nextMessage, "success");
    } catch (err) {
      const nextError = err?.message || "Could not start password reset.";
      setError(nextError);
      showToast?.(nextError, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-legal/10 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-legal/10 blur-3xl pointer-events-none" />
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-legal shadow-lg shadow-primary/25 mb-3">
            <Bot className="w-6 h-6 text-white" />
          </span>
          <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
          <p className="text-ink-2 text-sm mt-1">We&apos;ll email a single-use link if that account exists.</p>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-8 shadow-xl shadow-ink/5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}
            {message && (
              <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                {message}
              </div>
            )}
            <div>
              <label className="text-sm text-ink-2 mb-1 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-strong disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-ink-2 mt-6">
          <Link href="/signin" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}