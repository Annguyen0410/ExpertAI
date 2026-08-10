"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const toast = useToast();
  const showToast = toast?.addToast;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setDevResetUrl("");
    try {
      const data = await forgotPassword(email.trim().toLowerCase());
      const nextMessage = data?.message || "If an account exists for that email, password reset instructions have been sent.";
      setMessage(nextMessage);
      if (data?.dev_reset_url) setDevResetUrl(data.dev_reset_url);
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Bot className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-slate-400 text-sm mt-1">We&apos;ll email a single-use link if that account exists.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {message}
              {devResetUrl && (
                <p className="mt-2 break-all">
                  Dev reset link:{" "}
                  <a href={devResetUrl} className="text-indigo-300 hover:underline">
                    {devResetUrl}
                  </a>
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/signin" className="text-indigo-400 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
