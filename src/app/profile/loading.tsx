export default function ProfileLoading() {
  return (
    <div className="animate-pulse space-y-6 max-w-2xl mx-auto">
      <div className="h-8 w-32 rounded bg-white/10" />
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white/10" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-40 rounded bg-white/10" />
            <div className="h-4 w-56 rounded bg-white/5" />
          </div>
        </div>
        <div className="h-px bg-white/5" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 rounded bg-white/5" />
              <div className="h-10 rounded-lg bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
