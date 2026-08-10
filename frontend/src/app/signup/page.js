"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Shield, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Bot className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">Start with a free tier, no credit card needed</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              <p>{error}</p>
              {existingAccount && (
                <p className="mt-2">
                  <Link href="/signin" className="text-indigo-300 hover:underline">
                    Sign in instead?
                  </Link>
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-10 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="John Doe"
                maxLength={100}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Password</label>
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="At least 12 characters with upper, lower, number"
            />
            <p className="text-xs text-slate-500 mt-1">Must be 12+ chars with uppercase, lowercase, and number</p>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">I am a...</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="individual">Individual seeking guidance</option>
              <option value="professional">Professional (Lawyer/CPA/Doctor)</option>
            </select>
            {form.role === "professional" && (
              <p className="text-xs text-amber-400/90 mt-1">
                Professional accounts require an invitation. You can create an individual account now and upgrade later.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/signin" className="text-indigo-400 hover:underline">
            Sign in
          </Link>
        </p>
        <p className="text-center text-xs text-slate-600 mt-4">
          <Shield className="w-3 h-3 inline-block mr-1" /> Protected by rate limiting & encryption
        </p>
      </div>
    </div>
  );
}
