/**
 * Kaynaklar vites ve kasa tipini farklı yazıyor ("Tiptronik", "Suv", "Arazi aracı", "Hatchback 5 kapi"...).
 * Analiz ekranı bunları ham haliyle saydığı için aynı şey ayrı satırlar oluyor, bazıları (Tiptronik, Multitronic)
 * hiç görünmüyor ve yüzdeler yalnızca ilk birkaç satırın toplamına göre çıkıyordu. Bu dosya ortak yazımı üretir;
 * bilinmeyen/yer tutucu değerler `null` döner (analizde sayılmaz).
 */

const fold = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();

export function normalizeTransmission(raw?: string | null): "Manuel" | "Otomatik" | "Yarı Otomatik" | null {
  const v = fold(raw || "");
  if (!v || v === "bilinmiyor" || v === "belirtilmemis") return null;
  if (/yari|semi/.test(v)) return "Yarı Otomatik";
  if (/manuel|manual|duz/.test(v)) return "Manuel";
  // Tiptronik, Multitronic, DSG, CVT, Steptronic... hepsi otomatik şanzımandır.
  if (/otomatik|automatic|tiptronic|tiptronik|multitronic|multitronik|steptronic|steptronik|dsg|cvt|edc|powershift|s tronic|dct/.test(v)) return "Otomatik";
  return null;
}

/**
 * Vites filtresi için Mongo koşulu: "Otomatik" seçilince kaynakların "Tiptronik", "Multitronic" yazdığı
 * ilanlar da gelir (eskiden tam eşleşme olduğu için görünmüyorlardı).
 */
export function transmissionMatch(label: string): string | { $regex: string; $options: string } {
  const key = normalizeTransmission(label);
  if (key === "Otomatik") return { $regex: "^(otomatik|tiptronik|tiptronic|multitronik|multitronic|steptronik|steptronic)$", $options: "i" };
  if (key === "Manuel") return { $regex: "^(manuel|düz)$", $options: "i" };
  if (key === "Yarı Otomatik") return { $regex: "^yarı otomatik$", $options: "i" };
  return label;
}

export type VerifiableFeature = "transmission" | "fuelType" | "bodyType" | "color";

/**
 * Bu özelliği güvenilir olan ilanlar: Arabam dışındaki kaynaklar (bilgiyi doğrudan veriyor), ilan sayfasından
 * doğrulanan Arabam ilanları ve özelliği liste sayfası verisinden tek tek doğrulananlar (`verifiedFeatures`).
 * Arabam toplu çekiminin başlıktan tahmin ettiği değerler ("otomatik" yazmıyorsa "Manuel") dahil değildir.
 */
export function trustedFeatureFilter(feature: VerifiableFeature) {
  return {
    $or: [{ sourceSite: { $ne: "arabam" } }, { featuresVerifiedAt: { $exists: true } }, { verifiedFeatures: feature }],
  };
}

export type BodyTypeLabel =
  | "SUV"
  | "Sedan"
  | "Hatchback"
  | "Station Wagon"
  | "Coupe"
  | "Cabrio"
  | "Minivan / Van"
  | "Pick-up";

export function normalizeBodyType(raw?: string | null): BodyTypeLabel | null {
  const v = fold(raw || "");
  // "Otomobil" kaynakların kasa bilinmediğinde yazdığı yer tutucudur, gerçek bir kasa tipi değildir.
  if (!v || v === "otomobil" || v === "bilinmiyor" || v === "belirtilmemis") return null;
  if (/suv|arazi|crossover|cross over/.test(v)) return "SUV";
  if (/sedan/.test(v)) return "Sedan";
  if (/hatchback|hb\b/.test(v)) return "Hatchback";
  if (/station|kombi|wagon|estate|touring/.test(v)) return "Station Wagon";
  if (/cabrio|roadster|convertible|spider/.test(v)) return "Cabrio";
  if (/coupe/.test(v)) return "Coupe";
  if (/pick/.test(v)) return "Pick-up";
  if (/van|mpv|panel|combi|minibus|camlivan/.test(v)) return "Minivan / Van";
  return null;
}

export interface CategoryRow {
  /** Ham değer (kaynaktaki yazım). */
  _id: string | null;
  count: number;
  avgPrice: number;
}

export interface CategoryStat {
  label: string;
  count: number;
  avgPrice: number;
  /** Bilinen (yer tutucu olmayan) tüm ilanlar içindeki pay, %. */
  sharePct: number;
}

/**
 * Ham gruplamayı ortak yazıma çevirip birleştirir. Ortalama fiyat ilan sayısıyla ağırlıklandırılır;
 * yüzde, gösterilen ilk `limit` satırın değil TÜM bilinen ilanların toplamına göredir.
 */
export function mergeCategoryStats<T extends string>(
  rows: CategoryRow[],
  normalize: (raw?: string | null) => T | null,
  limit: number
): CategoryStat[] {
  const merged = new Map<T, { count: number; priceSum: number }>();
  for (const row of rows) {
    const label = normalize(row._id);
    if (!label) continue;
    const entry = merged.get(label) || { count: 0, priceSum: 0 };
    entry.count += row.count;
    entry.priceSum += row.avgPrice * row.count;
    merged.set(label, entry);
  }
  const total = [...merged.values()].reduce((sum, e) => sum + e.count, 0) || 1;
  return [...merged.entries()]
    .map(([label, e]) => ({
      label,
      count: e.count,
      avgPrice: Math.round(e.priceSum / Math.max(1, e.count)),
      sharePct: Math.round((e.count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Otomatik / manuel ortalama fiyat farkı (%); biri yoksa null. */
export function automaticPremiumPct(stats: Array<{ label: string; avgPrice: number }>): number | null {
  const auto = stats.find((s) => s.label === "Otomatik")?.avgPrice;
  const manual = stats.find((s) => s.label === "Manuel")?.avgPrice;
  if (!auto || !manual) return null;
  return Math.round((auto / manual - 1) * 100);
}
