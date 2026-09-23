export default function OffersLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-40 rounded bg-white/10" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 flex gap-4">
            <div className="h-20 w-28 shrink-0 rounded-lg bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 rounded bg-white/10" />
              <div className="h-4 w-1/2 rounded bg-white/5" />
              <div className="flex gap-2">
                <div className="h-7 w-24 rounded-full bg-amber-400/10" />
                <div className="h-7 w-20 rounded-full bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
