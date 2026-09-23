import { parseDamageReport, damageLevelLabel, type DamageLevel } from "@/lib/damage-report";



const TONE: Record<string, { body: string; ring: string; text: string; badge: string }> = {
  original: {
    body: "#10b981", ring: "border-emerald-400/30", text: "text-emerald-300",
    badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  },
  light: {
    body: "#eab24a", ring: "border-amber-400/30", text: "text-amber-300",
    badge: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  },
  moderate: {
    body: "#f97316", ring: "border-orange-400/30", text: "text-orange-300",
    badge: "border-orange-400/30 bg-orange-500/15 text-orange-300",
  },
  heavy: {
    body: "#ef4444", ring: "border-red-400/30", text: "text-red-300",
    badge: "border-red-400/30 bg-red-500/15 text-red-300",
  },
  unknown: {
    body: "#64748b", ring: "border-white/10", text: "text-slate-400",
    badge: "border-white/10 bg-white/5 text-slate-400",
  },
};


const PART_STATE: Record<string, { label: string; color: string }> = {
  "Değişmiş": { label: "değişmiş", color: "#ef4444" },
  "Boyanmış": { label: "boyanmış", color: "#f97316" },
  "Lokal Boyanmış": { label: "lokal boyalı", color: "#eab24a" },
  "Orijinal": { label: "orijinal", color: "#10b981" },
};

export function DamageDiagram({
  paintChange,
  damageFlag,
  damageParts = [],
}: {
  paintChange?: string;
  damageFlag?: boolean;
  
  damageParts?: { name: string; state: string }[];
}) {
  const report = parseDamageReport(paintChange);
  const tone = TONE[report.level];

  
  const affectedParts = damageParts.filter(
    (p) => p.state === "Değişmiş" || p.state === "Boyanmış" || p.state === "Lokal Boyanmış"
  );

  return (
    <div className={`card space-y-4 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Hasar / boya durumu</h2>
        <span className={`badge ${tone.badge}`}>{damageLevelLabel(report.level)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-6">
      
        <CarSvg report={report} color={tone.body} affectedParts={affectedParts} />

        <div className="min-w-[200px] flex-1 space-y-3">
          <p className={`text-sm ${tone.text}`}>{report.summary}</p>

        
          {!report.unknown && !report.allOriginal && (
            <ul className="space-y-1.5">
              {report.changed > 0 && (
                <Row
                  count={report.changed}
                  term="parça değişmiş"
                  hint="Orijinal parça sökülüp yenisi takılmış — en ciddi müdahale."
                />
              )}
              {report.painted > 0 && (
                <Row
                  count={report.painted}
                  term="parça boyanmış"
                  hint="Parçanın tamamı yeniden boyanmış."
                />
              )}
              {report.localPainted > 0 && (
                <Row
                  count={report.localPainted}
                  term="parça lokal boyalı"
                  hint="Parçanın yalnızca küçük bir bölümü boyanmış (çizik/ufak darbe)."
                />
              )}
            </ul>
          )}

          {affectedParts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                İşlem görmüş parçalar
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {affectedParts.map((part) => {
                  const meta = PART_STATE[part.state];
                  return (
                    <li
                      key={part.name}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs"
                    >
                      <span className="text-slate-200">{part.name}</span>
                      <span className="text-slate-500"> — </span>
                      <span style={{ color: meta?.color }}>{meta?.label || part.state}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {damageFlag && (
            <p className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              Bu araçta hasar kaydı bildirilmiş. Satın almadan önce ekspertiz yaptırman önerilir.
            </p>
          )}

          <p className="text-xs text-slate-500">
            Bilgi ilan sahibinin/kaynak sitenin beyanıdır.
            {affectedParts.length === 0 &&
              " Bu ilan için parça bazlı ayrıntı kaynakta bulunmadığından yalnızca sayılar gösteriliyor."}
          </p>
        </div>
      </div>
    </div>
  );
}


function partPosition(name: string): { x: number; y: number } {
  const n = name.toLocaleLowerCase("tr-TR");
  const isRight = /sağ/.test(n);
  const isLeft = /sol/.test(n);
  const isFront = /ön/.test(n);
  const isRear = /arka/.test(n);
  const side = isRight ? 85 : isLeft ? 35 : null;

  if (/tampon/.test(n)) return { x: 60, y: isRear ? 218 : 12 };

  if (/kaput/.test(n)) return { x: 60, y: isRear ? 192 : 38 };
  if (/bagaj/.test(n)) return { x: 60, y: 192 };
  if (/tavan/.test(n)) return { x: 60, y: 108 };
  if (/ayna/.test(n)) return { x: side ?? 85, y: 68 };
  if (/çamurluk/.test(n)) return { x: side ?? 85, y: isRear ? 158 : 66 };
  if (/kapı/.test(n)) return { x: side ?? 85, y: isRear ? 128 : 92 };
  if (/far|stop/.test(n)) return { x: side ?? 85, y: isRear ? 204 : 20 };
  if (side !== null) return { x: side, y: isFront ? 40 : isRear ? 180 : 108 };
  if (isFront) return { x: 60, y: 30 };
  if (isRear) return { x: 60, y: 198 };
  return { x: 60, y: 108 };
}

const CAR_BODY = (
  <>
    <path
      d="M60 8c14 0 22 10 25 24l4 22c2 12 3 26 3 44s-1 32-3 44l-4 22c-3 14-11 24-25 24s-22-10-25-24l-4-22c-2-12-3-26-3-44s1-32 3-44l4-22C38 18 46 8 60 8z"
      fill="url(#dmgBody)"
      strokeWidth="2"
    />
    <path d="M44 46h32l4 20H40z" fillOpacity="0.35" />
    <path d="M40 156h40l-4 18H44z" fillOpacity="0.35" />
    <rect x="42" y="72" width="36" height="78" rx="8" fillOpacity="0.18" />
    <rect x="27" y="70" width="9" height="6" rx="3" fillOpacity="0.6" />
    <rect x="84" y="70" width="9" height="6" rx="3" fillOpacity="0.6" />
  </>
);

const MAX_PART_ARROWS = 8;


function CarSvg({
  report,
  color,
  affectedParts,
}: {
  report: ReturnType<typeof parseDamageReport>;
  color: string;
  affectedParts: { name: string; state: string }[];
}) {
  if (affectedParts.length > 0) {
    return <PartsCarSvg parts={affectedParts} color={color} level={report.level} />;
  }

  
  const labels: { text: string; tone: string }[] = [];
  if (report.allOriginal) {
    labels.push({ text: "Tamamı orijinal", tone: "#10b981" });
  } else if (report.unknown) {
    labels.push({ text: "Bilgi verilmemiş", tone: "#64748b" });
  } else {
    if (report.changed > 0) labels.push({ text: `${report.changed} değişen`, tone: "#ef4444" });
    if (report.painted > 0) labels.push({ text: `${report.painted} boyalı`, tone: "#f97316" });
    if (report.localPainted > 0)
      labels.push({ text: `${report.localPainted} lokal boyalı`, tone: "#eab24a" });
    if (labels.length === 0) labels.push({ text: "Tamamı boyalı", tone: "#ef4444" });
  }


  const top = 40;
  const gap = labels.length > 1 ? 130 / (labels.length - 1) : 0;

  return (
    <svg
      viewBox="0 0 260 220"
      className="h-52 w-auto shrink-0"
      role="img"
      aria-label={`Araç durumu: ${damageLevelLabel(report.level)}`}
    >
      <defs>
        <linearGradient id="dmgBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <g transform="translate(6,0)" stroke={color} fill={color}>
        {CAR_BODY}
      </g>

     
      {labels.map((label, i) => {
        const y = labels.length === 1 ? 110 : top + i * gap;
        return (
          <g key={label.text}>
            <line
              x1="102"
              y1={y}
              x2="140"
              y2={y}
              stroke={label.tone}
              strokeWidth="1.6"
              strokeDasharray="3 3"
            />
            <circle cx="102" cy={y} r="3.5" fill={label.tone} />
           
            <text x="146" y={y + 4} fill="#e2e8f0" fontSize="13" fontWeight="700" fontFamily="inherit">
              {label.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}


function PartsCarSvg({
  parts,
  color,
  level,
}: {
  parts: { name: string; state: string }[];
  color: string;
  level: DamageLevel;
}) {
 
  const withPos = parts.map((part) => ({ part, pos: partPosition(part.name) }));
  withPos.sort((a, b) => a.pos.y - b.pos.y);
  const shown = withPos.slice(0, MAX_PART_ARROWS);
  const extra = withPos.length - shown.length;

  const top = 24;
  const bottom = 200;
  const gap = shown.length > 1 ? (bottom - top) / (shown.length - 1) : 0;

  return (
    <svg
      viewBox="0 0 260 220"
      className="h-52 w-auto shrink-0"
      role="img"
      aria-label={`Araç durumu: ${damageLevelLabel(level)}`}
    >
      <defs>
        <linearGradient id="dmgBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <g transform="translate(6,0)" stroke={color} fill={color}>
        {CAR_BODY}
      </g>

      {shown.map(({ part, pos }, i) => {
        const bodyX = pos.x + 6; 
        const labelY = shown.length === 1 ? 110 : top + i * gap;
        const tone = PART_STATE[part.state]?.color || "#94a3b8";
        return (
          <g key={`${part.name}-${i}`}>
            <line
              x1={bodyX}
              y1={pos.y}
              x2="140"
              y2={labelY}
              stroke={tone}
              strokeWidth="1.6"
              strokeDasharray="3 3"
            />
            <circle cx={bodyX} cy={pos.y} r="3.5" fill={tone} />
            <text x="146" y={labelY + 4} fill="#e2e8f0" fontSize="12" fontWeight="700">
              {part.name}
            </text>
          </g>
        );
      })}
      {extra > 0 && (
        <text x="146" y={bottom + 16} fill="#64748b" fontSize="11">
          +{extra} parça daha (aşağıdaki listede)
        </text>
      )}
    </svg>
  );
}


function Row({ count, term, hint }: { count: number; term: string; hint: string }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-sm font-semibold text-slate-100">
        {count} {term}
      </p>
      <p className="text-xs text-slate-400">{hint}</p>
    </li>
  );
}
