export default function MapLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded bg-white/10" />
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-white/5" />
          <div className="h-9 w-28 rounded-lg bg-white/5" />
        </div>
      </div>
      {/* Harita alanı skeleton */}
      <div className="card overflow-hidden">
        <div className="h-[70vh] rounded-xl bg-white/5 flex items-center justify-center">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-white/10" />
            <div className="h-4 w-32 mx-auto rounded bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
