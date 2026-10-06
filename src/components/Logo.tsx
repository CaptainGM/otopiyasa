/**
 * İşaret: hız göstergesi biçiminde piyasa göstergesi. Üç yay ucuz (nane) → adil (buz mavisi) → pahalı (mercan),
 * ibre ucuz bölgede. Hem "oto" hem "piyasa": kartlardaki fiyat göstergesiyle aynı dil.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="0.5" y="0.5" width="63" height="63" rx="16" fill="#121418" stroke="rgba(255,255,255,0.12)" />
      <g strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M15.09 42.16 A18 18 0 0 1 20.67 22.01" stroke="#34d399" />
        <path d="M21.68 21.25 A18 18 0 0 1 42.32 21.25" stroke="#7dd3fc" />
        <path d="M43.33 22.01 A18 18 0 0 1 48.91 42.16" stroke="#fb7185" />
      </g>
      <path d="M32 36 L20.74 29.5" stroke="#f2f1ec" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="36" r="3.6" fill="#f2b544" />
      <path d="M22 50h20" stroke="rgba(255,255,255,0.22)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={compact ? 36 : 38} />
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-[1.2rem] font-bold text-[var(--text)]">
            Oto<span className="text-[var(--accent)]">Piyasa</span>
          </p>
          <p className="eyebrow mt-1 !text-[0.58rem] !tracking-[0.2em]">İlan fiyat istihbaratı</p>
        </div>
      )}
    </div>
  );
}
