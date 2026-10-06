import type { HealthIssue } from "@/lib/health-check";

/**
 * Yönetim paneli: sistemin anlık sağlığı (bkz. lib/health-check.ts). Sorun yoksa tek satır; varsa ne olduğu.
 * Aynı denetim saatte bir sunucu motorunda ve günde bir Vercel'de çalışıp yöneticiye bildirim gönderir.
 */
export function SystemHealthCard({ issues, checkedAt }: { issues: HealthIssue[]; checkedAt: Date }) {
  const time = checkedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  if (issues.length === 0) {
    return (
      <div className="card flex items-center gap-3 border-emerald-500/25 p-4">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400/60" />
        <p className="text-sm text-slate-300">
          <strong className="text-emerald-300">Sistem sağlıklı.</strong> Sunucu motoru, bekçi, kaynaklar ve ilan akışı
          normal ({time} denetimi). Bir şey bozulursa e-posta ve bildirim gelir.
        </p>
      </div>
    );
  }
  return (
    <div className="card space-y-3 border-rose-500/30 p-4">
      <p className="text-sm font-bold text-rose-200">
        Sistem denetimi {issues.length} sorun buldu <span className="font-normal text-slate-400">({time})</span>
      </p>
      <ul className="space-y-2">
        {issues.map((issue) => (
          <li key={issue.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className={`text-sm font-semibold ${issue.severity === "critical" ? "text-rose-300" : "text-amber-300"}`}>
              {issue.title}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{issue.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
