"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import ThemeToggle from "../../components/ThemeToggle";

export default function SignIn() {
  const router = useRouter();
  const { signin } = useAuth();
  const toast = useToast();
  const showToast = toast?.addToast;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signin(email.trim().toLowerCase(), password);
      showToast?.("Welcome back!", "success");
      router.push("/dashboard");
    } catch (err) {
      const message = err?.message || "Sign in failed. Please try again.";
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
          <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
          <p className="text-ink-2 text-sm mt-1">Sign in to continue to ExpertAI</p>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-8 shadow-xl shadow-ink/5 animate-fade-up delay-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                {error}
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
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-ink-2">Password</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:outline-none focus:ring-2 focus:ring-primary pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-strong disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-ink-2 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}