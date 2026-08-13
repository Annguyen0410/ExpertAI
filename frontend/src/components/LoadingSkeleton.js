export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-5 animate-pulse">
      <div className="h-4 bg-ink-3/20 rounded w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 bg-ink-3/20 rounded mb-2 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-line p-4 animate-pulse">
      <div className="h-3 bg-ink-3/20 rounded w-1/2 mb-3" />
      <div className="h-7 bg-ink-3/20 rounded w-1/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-surface rounded-xl border border-line p-4">
          <div className="h-4 bg-ink-3/20 rounded w-2/3 mb-2" />
          <div className="h-3 bg-ink-3/20 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-end">
        <div className="bg-ink-3/20 rounded-2xl px-5 py-3 w-2/3">
          <div className="h-3 bg-ink-3/10 rounded w-full mb-2" />
          <div className="h-3 bg-ink-3/10 rounded w-2/3" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-ink-3/20 shrink-0" />
        <div className="bg-surface rounded-2xl px-5 py-3 w-3/4 border border-line">
          <div className="h-3 bg-ink-3/20 rounded w-full mb-2" />
          <div className="h-3 bg-ink-3/20 rounded w-full mb-2" />
          <div className="h-3 bg-ink-3/20 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}