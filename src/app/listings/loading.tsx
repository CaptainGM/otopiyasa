export default function ListingsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded bg-white/10" />
        <div className="h-9 w-32 rounded-lg bg-amber-400/10" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-[16/10] bg-white/5" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-3/4 rounded bg-white/10" />
              <div className="h-4 w-1/2 rounded bg-white/5" />
              <div className="flex justify-between items-center">
                <div className="h-6 w-28 rounded bg-amber-400/10" />
                <div className="h-6 w-20 rounded-full bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
