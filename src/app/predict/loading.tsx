export default function PredictLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-56 rounded bg-white/10" />
      <div className="card p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 rounded bg-white/5" />
              <div className="h-10 rounded-lg bg-white/5" />
            </div>
          ))}
        </div>
        <div className="h-12 w-48 rounded-xl bg-amber-400/10" />
      </div>
    </div>
  );
}
