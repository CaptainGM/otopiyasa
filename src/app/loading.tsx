/**
 * Ana sayfa loading skeleton — sayfa geçişlerinde anında görünür,
 * arka planda veri yüklenirken kullanıcı boş ekrana bakmaz.
 */
export default function HomeLoading() {
  return (
    <div className="space-y-8 pb-10 animate-pulse">
      {/* Hero skeleton */}
      <section className="card overflow-hidden p-6 sm:p-8 md:p-10">
        <div className="hero-grid items-center">
          <div className="space-y-5">
            <div className="h-5 w-40 rounded-full bg-white/10" />
            <div className="space-y-3">
              <div className="h-10 w-3/4 rounded bg-white/10" />
              <div className="h-10 w-1/2 rounded bg-white/10" />
            </div>
            <div className="h-4 w-2/3 rounded bg-white/5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="stat-tile h-20" />
            <div className="stat-tile h-20 sm:col-span-2" />
          </div>
        </div>
      </section>

      {/* Filtreler skeleton */}
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-white/5" />
          ))}
        </div>
      </div>

      {/* Başlık skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded bg-white/10" />
        <div className="h-6 w-20 rounded bg-white/5" />
      </div>

      {/* Araç kartları skeleton */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-[16/10] bg-white/5" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-3/4 rounded bg-white/10" />
              <div className="h-4 w-1/2 rounded bg-white/5" />
              <div className="flex justify-between">
                <div className="h-6 w-28 rounded bg-amber-400/10" />
                <div className="h-4 w-16 rounded bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
