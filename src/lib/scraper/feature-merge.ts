import { normalizeBodyType, normalizeTransmission } from "@/lib/vehicle-attrs";
import { normalizeFuelType } from "@/lib/normalize-fuel";

/**
 * ÖZELLİK YAZMA KURALI (tüm kaynaklar için ortak): veritabanında bir özellik ya kaynağın kendi verisinde yazan
 * gerçek değerdir ya da bilinmiyordur. Kaynaklar tahmin üretmez ("otomatik yazmıyorsa Manuel" gibi); bu dosya
 * yeni gelen değerin kayıtlı değere ne zaman yazılacağına karar verir.
 */

export const VERIFIABLE_FEATURES = ["transmission", "fuelType", "bodyType", "color"] as const;
export type VerifiableFeature = (typeof VERIFIABLE_FEATURES)[number];

/** Kaynakların "bilinmiyor" anlamında yazdığı yer tutucular. */
const UNKNOWN = new Set(["", "-", "bilinmiyor", "belirtilmemiş", "belirtilmemis", "otomobil", "diğer", "diger"]);
export const isUnknownFeature = (value: unknown) =>
  typeof value !== "string" || UNKNOWN.has(value.trim().toLocaleLowerCase("tr-TR"));

/** Aynı anlamdaki farklı yazımlar ("Tam Otomatik" / "Otomatik", "beyaz" / "Beyaz") değişiklik sayılmaz. */
function sameMeaning(key: VerifiableFeature, a: string, b: string): boolean {
  const lower = (s: string) => s.trim().toLocaleLowerCase("tr-TR");
  if (lower(a) === lower(b)) return true;
  if (key === "transmission") return normalizeTransmission(a) !== null && normalizeTransmission(a) === normalizeTransmission(b);
  if (key === "fuelType") return normalizeFuelType(a) === normalizeFuelType(b);
  if (key === "bodyType") return normalizeBodyType(a) !== null && normalizeBodyType(a) === normalizeBodyType(b);
  return false;
}

/**
 * Yazılacak özellikler: yeni değer biliniyorsa ve kayıtlıdan anlamca farklıysa. Bilinmeyen yeni değer kayıtlı
 * bilgiyi asla ezmez.
 */
export function knownFeatureUpdates(
  incoming: Record<string, unknown> | undefined,
  stored: Record<string, unknown> | undefined
): Partial<Record<VerifiableFeature, string>> {
  const out: Partial<Record<VerifiableFeature, string>> = {};
  for (const key of VERIFIABLE_FEATURES) {
    const next = incoming?.[key];
    if (isUnknownFeature(next)) continue;
    const current = stored?.[key];
    if (!isUnknownFeature(current) && sameMeaning(key, String(current), String(next))) continue;
    // Sonradan takılmış LPG fabrika kaydındaki "Benzin" ile ezilmez.
    if (key === "fuelType" && normalizeFuelType(String(current)) === "LPG & Benzin" && normalizeFuelType(String(next)) === "Benzin") continue;
    out[key] = String(next).trim();
  }
  return out;
}

/** Arabam ilanının henüz kaynaktan okunmamış özelliği için gösterilen metin. */
export const PENDING_FEATURE_LABEL = "Doğrulanıyor";

/**
 * Gösterim: Arabam toplu çekiminden gelen ilanların vites/yakıt/kasa bilgisi bekçi ilanı (ya da liste sayfasını)
 * okuyana kadar bilinmez. Bu sürede "Bilinmiyor" yerine "Doğrulanıyor" gösterilir; ilan sayfası okunduğu hâlde
 * yazmıyorsa "Bilinmiyor/Belirtilmemiş" kalır.
 */
export function withPendingLabels<T extends object>(
  features: T,
  doc: { sourceSite?: string | null; verifiedFeatures?: string[] | null; featuresVerifiedAt?: Date | string | null }
): T {
  if (doc.sourceSite !== "arabam" || doc.featuresVerifiedAt) return features;
  const out = { ...features } as Record<string, unknown>;
  for (const key of ["transmission", "fuelType", "bodyType"] as const) {
    if (key in out && isUnknownFeature(out[key]) && !(doc.verifiedFeatures || []).includes(key)) out[key] = PENDING_FEATURE_LABEL;
  }
  return out as T;
}

/** Arşivleme gerekçesi: kapsam dışı araç (kamyon, pickup, motosiklet...). */
export const PLATFORM_SCOPE_REASON = "Platform dışı araç";

/**
 * Kaynakta yeniden görülse bile geri açılmaması gereken arşiv: yöneticinin elle kaldırdığı ilanlar ve kapsam dışı
 * / araç olmayan ilanlar. Diğer arşivler (doğrulamada "kaldırılmış" görünen) ilan yeniden görülünce açılır.
 */
export function isPermanentRemoval(reason?: string | null): boolean {
  return /^manuel|platform dışı|otomobil ilanı değil/i.test(reason || "");
}
