export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded bg-white/10" />
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-white/5" />
          <div className="h-9 w-28 rounded-lg bg-white/5" />
        </div>
      </div>

      {/* Daemon panel skeleton */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/5" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-64 rounded bg-white/10" />
            <div className="h-3 w-48 rounded bg-white/5" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-emerald-400/10" />
        </div>
        {/* Terminal skeleton */}
        <div className="rounded-xl bg-black/30 p-4 space-y-2 h-48">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-3 rounded bg-white/5" style={{ width: `${60 + Math.random() * 35}%` }} />
          ))}
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="h-8 w-16 rounded bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
