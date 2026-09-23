export default function CarsDetailLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Geri butonu */}
      <div className="h-5 w-24 rounded bg-white/10" />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Sol — galeri */}
        <div className="space-y-4">
          <div className="aspect-[16/10] rounded-2xl bg-white/5" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 w-20 rounded-lg bg-white/5" />
            ))}
          </div>
        </div>

        {/* Sağ — detaylar */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="h-7 w-3/4 rounded bg-white/10" />
            <div className="h-9 w-1/2 rounded bg-amber-400/10" />
            <div className="h-px bg-white/5" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-5 rounded bg-white/5" />
              ))}
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <div className="h-5 w-1/3 rounded bg-white/10" />
            <div className="h-4 w-full rounded bg-white/5" />
            <div className="h-4 w-2/3 rounded bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
