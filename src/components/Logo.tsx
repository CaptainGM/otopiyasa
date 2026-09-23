export function Logo({ compact = false }: { compact?: boolean }) {
 
  const gradId = compact ? "logoGradientCompact" : "logoGradient";
  return (
    <div className="flex items-center gap-3">
      <svg
        width={compact ? 36 : 42}
        height={compact ? 36 : 42}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="64" height="64" rx="16" fill={`url(#${gradId})`} />
        <path
          d="M13 39l3.6-9.4A5 5 0 0 1 21.3 26h21.4a5 5 0 0 1 4.7 3.3L51 39v7.5a2 2 0 0 1-2 2h-3.2a2 2 0 0 1-2-2V46H20.2v.5a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2z"
          fill="#0b0f16"
        />
        <circle cx="21.5" cy="41.5" r="3.2" fill="#F5BE4F" />
        <circle cx="42.5" cy="41.5" r="3.2" fill="#F5BE4F" />
        <path d="M19 30.5l1.6-3.2h22.8l1.6 3.2z" fill="#0b0f16" opacity="0.35" />
        <defs>
          <linearGradient id={gradId} x1="8" y1="8" x2="56" y2="56">
            <stop stopColor="#F5BE4F" />
            <stop offset="1" stopColor="#C2650E" />
          </linearGradient>
        </defs>
      </svg>
      {!compact && (
        <div>
          <p className="text-xl font-black tracking-tight text-[var(--text)]">
            Oto<span className="text-amber-300">Piyasa</span>
          </p>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
            İlan fiyat istihbaratı
          </p>
        </div>
      )}
    </div>
  );
}
