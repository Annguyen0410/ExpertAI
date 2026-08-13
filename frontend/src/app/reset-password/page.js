"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import ThemeToggle from "../../components/ThemeToggle";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const toast = useToast();
  const showToast = toast?.addToast;
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the one-time reset token from the URL on mount
    setToken(params.get("token") || "");
  }, []);

  function validatePassword(value) {
    if (value.length < 12) return "Password must be at least 12 characters";
    if (!/[A-Z]/.test(value)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(value)) return "Password must contain at least one lowercase letter";
    if (!/\d/.test(value)) return "Password must contain at least one number";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token) {
      setError("This reset link is missing a token. Request a new one.");
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await resetPassword(token, password);
      showToast?.("Password updated. Please sign in.", "success");
      router.push("/signin");
    } catch (err) {
      const message = err?.message || "Could not reset password.";
      setError(message);
      showToast?.(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-legal/10 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-blob" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-legal/10 blur-3xl pointer-events-none animate-blob" style={{ animationDelay: "-9s" }} />
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8 animate-fade-up">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-legal shadow-lg shadow-primary/25 mb-3 animate-float">
            <Bot className="w-6 h-6 text-white" />
          </span>
          <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
          <p className="text-ink-2 text-sm mt-1">Must be 12+ characters with upper, lower, and a number.</p>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-8 shadow-xl shadow-ink/5 animate-fade-up delay-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}
            <div>
              <label className="text-sm text-ink-2 mb-1 block">New password</label>
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm text-ink-2 mb-1 block">Confirm new password</label>
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full bg-primary hover:bg-primary-strong disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-ink-2 mt-6">
          <Link href="/forgot-password" className="text-primary hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}