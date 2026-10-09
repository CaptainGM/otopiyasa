/**
 * ARABAM DOĞRULAMA TERMİNAL SATIRLARI (scrape.bat 11): her ilan için bir satır. Eskiden her ilan "çekiliyor ve kaydediliyor" diye
 * yazılıyordu; ilanın canlı olup olmadığı, fiyatı/kilometresi değişip değişmediği görünmüyordu.
 */
export interface SaveDetail {
  priceFrom?: number;
  priceTo?: number;
  mileageFrom?: number;
  mileageTo?: number;
  descChanged?: boolean;
  damageChanged?: boolean;
  imagesEnriched?: boolean;
  featuresChanged?: boolean;
}

export type VerifyKind = "alive" | "changed" | "reactivated" | "gone" | "blocked" | "skipped" | "unparsed";

const num = (n: number) => n.toLocaleString("tr-TR");

/** "1.250.000 → 1.230.000 TL (−20.000)" */
function priceText(from: number, to: number): string {
  const diff = to - from;
  return `fiyat ${num(from)} → ${num(to)} TL (${diff < 0 ? "−" : "+"}${num(Math.abs(diff))})`;
}

/** Değişiklik özeti: fiyat, kilometre ve diğer alanlar. */
export function describeChange(detail: SaveDetail | undefined): string {
  if (!detail) return "";
  const parts: string[] = [];
  if (detail.priceFrom !== undefined && detail.priceTo !== undefined && detail.priceFrom !== detail.priceTo) {
    parts.push(priceText(detail.priceFrom, detail.priceTo));
  }
  if (detail.mileageFrom !== undefined && detail.mileageTo !== undefined && detail.mileageFrom !== detail.mileageTo) {
    parts.push(`km ${num(detail.mileageFrom)} → ${num(detail.mileageTo)}`);
  }
  if (detail.descChanged) parts.push("açıklama değişti");
  if (detail.damageChanged) parts.push("hasar bilgisi değişti");
  if (detail.imagesEnriched) parts.push("fotoğraflar tamamlandı");
  if (detail.featuresChanged) parts.push("bilgiler tamamlandı");
  return parts.join(" · ");
}

/** İlan adresindeki okunur ad: "/ilan/galeriden-satilik-fiat-egea-1-4/baslik/123" → "fiat egea 1 4". */
export function titleFromHref(href: string): string {
  const seg = /^\/ilan\/([^/]+)\//.exec(href)?.[1] ?? href;
  const i = seg.indexOf("satilik-");
  return (i >= 0 ? seg.slice(i + 8) : seg).replace(/-/g, " ");
}

export function formatVerifyLine(input: { kind: VerifyKind; title: string; detail?: SaveDetail; time?: Date }): string {
  const time = (input.time ?? new Date()).toLocaleTimeString("tr-TR");
  const title = input.title.length > 60 ? `${input.title.slice(0, 57)}...` : input.title;
  const change = describeChange(input.detail);
  switch (input.kind) {
    case "alive":
      return `  [${time}] ✓ canlı · değişiklik yok · ${title}`;
    case "changed":
      return `  [${time}] ✓ canlı · ${change || "bilgiler güncellendi"} · ${title}`;
    case "reactivated":
      return `  [${time}] ↩ arşivden geri açıldı (kaynakta yayında) · ${change ? `${change} · ` : ""}${title}`;
    case "gone":
      return `  [${time}] 🗑 kaynakta yok (kaldırılmış/satılmış) · ${title}`;
    case "blocked":
      return `  [${time}] ⛔ okunamadı (engel / ağ hatası) · ${title}`;
    case "skipped":
      return `  [${time}] – atlandı (kapsam dışı ya da fiyatsız) · ${title}`;
    case "unparsed":
      return `  [${time}] ? sayfa açıldı ama okunamadı (ilana dokunulmadı, sonra yeniden denenir) · ${title}`;
  }
}

export interface QueueMix {
  recheck: number;
  missing: number;
  never: number;
  stale: number;
}

export function describeQueueMix(mix: QueueMix): string {
  const parts: string[] = [];
  if (mix.never) parts.push(`${num(mix.never)} hiç doğrulanmamış`);
  if (mix.stale) parts.push(`${num(mix.stale)} en eski doğrulanan`);
  if (mix.missing) parts.push(`${num(mix.missing)} site haritasında görünmeyen`);
  if (mix.recheck) parts.push(`${num(mix.recheck)} arşivdeki ilanın yeniden kontrolü`);
  return parts.length ? parts.join(", ") : "boş";
}
