"use client";

import Link from "next/link";
import { RefreshCw, ShieldAlert } from "lucide-react";

export default function ErrorPage({ reset, unstable_retry }) {
  const retry = reset || unstable_retry;

  return (
    <main className="min-h-screen bg-bg px-6 py-16 text-ink">
      <section className="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-semibold">We couldn&rsquo;t load this view</h1>
        <p className="mt-3 text-sm leading-6 text-ink-2">Your information was not changed. Try again, or return to your workspace.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => retry?.()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium hover:bg-primary-strong">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
          <Link href="/dashboard" className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink">Go to dashboard</Link>
        </div>
      </section>
    </main>
  );
}