export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 animate-pulse">
      <div className="h-4 bg-slate-800 rounded w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 bg-slate-800 rounded mb-2 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 animate-pulse">
      <div className="h-3 bg-slate-800 rounded w-1/2 mb-3" />
      <div className="h-7 bg-slate-800 rounded w-1/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="h-4 bg-slate-800 rounded w-2/3 mb-2" />
          <div className="h-3 bg-slate-800 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-end">
        <div className="bg-slate-800 rounded-2xl px-5 py-3 w-2/3">
          <div className="h-3 bg-slate-700 rounded w-full mb-2" />
          <div className="h-3 bg-slate-700 rounded w-2/3" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-800 shrink-0" />
        <div className="bg-slate-900 rounded-2xl px-5 py-3 w-3/4">
          <div className="h-3 bg-slate-800 rounded w-full mb-2" />
          <div className="h-3 bg-slate-800 rounded w-full mb-2" />
          <div className="h-3 bg-slate-800 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}
