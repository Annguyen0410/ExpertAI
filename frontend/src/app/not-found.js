import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg px-6 py-16 text-ink">
      <section className="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-8 text-center shadow-2xl">
        <SearchX className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="font-display mt-5 text-2xl font-semibold">This page isn&rsquo;t available</h1>
        <p className="mt-3 text-sm leading-6 text-ink-2">It may have moved, or you may not have access to it.</p>
        <Link href="/dashboard" className="mt-7 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium hover:bg-primary-strong">Return to dashboard</Link>
      </section>
    </main>
  );
}