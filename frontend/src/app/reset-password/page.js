"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Bot className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="text-slate-400 text-sm mt-1">Must be 12+ characters with upper, lower, and a number.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
          <div>
            <label className="text-sm text-slate-400 mb-1 block">New password</label>
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Confirm new password</label>
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/forgot-password" className="text-indigo-400 hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
