export default function AnalyticsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-44 rounded bg-white/10" />

      {/* İstatistik kartları */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-4 w-20 rounded bg-white/5" />
            <div className="h-8 w-24 rounded bg-white/10" />
          </div>
        ))}
      </div>

      {/* Grafik alanları */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5 space-y-4">
          <div className="h-5 w-36 rounded bg-white/10" />
          <div className="h-64 rounded-xl bg-white/5" />
        </div>
        <div className="card p-5 space-y-4">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="h-64 rounded-xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}
