"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Shield, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function SignUpPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const { addToast: showToast } = useToast();
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "individual" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(form.email.trim().toLowerCase(), form.password, form.name.trim(), form.role);
      showToast("Account created successfully!", "success");
      router.push("/dashboard");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Bot className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">Start with a free tier, no credit card needed</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="At least 8 characters with upper, lower, number"
            />
            <p className="text-xs text-slate-500 mt-1">Must be 8+ chars with uppercase, lowercase, and number</p>
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
          <a href="/signin" className="text-indigo-400 hover:underline">
            Sign in
          </a>
        </p>
        <p className="text-center text-xs text-slate-600 mt-4">
          <Shield className="w-3 h-3 inline-block mr-1" /> Protected by rate limiting & encryption
        </p>
      </div>
    </div>
  );
}