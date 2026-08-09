"use client";

import Link from "next/link";
import { RefreshCw, ShieldAlert } from "lucide-react";

export default function ErrorPage({ reset, unstable_retry }) {
  const retry = reset || unstable_retry;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-lg rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">We couldn&rsquo;t load this view</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Your information was not changed. Try again, or return to your workspace.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => retry?.()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium hover:bg-indigo-500">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
          <Link href="/dashboard" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white">Go to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
