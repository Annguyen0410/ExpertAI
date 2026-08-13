import { CardSkeleton } from "../components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-bg px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-3/20" />
        <div className="grid gap-4 md:grid-cols-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={6} />
      </div>
    </main>
  );
}