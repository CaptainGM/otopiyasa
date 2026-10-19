import type { PriceScale } from "@/lib/price-scale";
import { FUEL_TYPES, normalizeFuelType } from "@/lib/normalize-fuel";

/**
 * SATIŞ FORMU FİYAT ARALIĞI: saf kurallar (web, API ve mobil aynı eşikleri kullanır).
 *
 * Aralık, aynı model ailesinden emsallerin hasar durumu, yıl, km, yakıt, vites ve motor hacmine göre seçilen kademesinden gelir
 * (sunucu: sell-estimate-data.ts). Bu dosya yalnızca "ne zaman gösterilir" ve "ne zaman engellenir" kuralını verir:
 * - Aralık, en az SELL_RULES.minComparables emsal ve dar bir yayılım (p75 − p25, orta değerin en çok %35'i) varsa gösterilir.
 * - Girilen fiyat orta değerin highBlock katından yüksekse her zaman engellenir.
 * - Girilen fiyat orta değerin lowBlock katından düşükse engellenir; yalnızca hasar durumu bildirildiğinde (bilinmeyen ilanda
 *   emsal karışık olur, temiz araç hasarlı araçlarla kıyaslanıp yanlışlıkla engellenmesin).
 * - Aralığın %20 dışı yalnızca uyarıdır: satıcı kendi fiyatını seçebilir.
 * Ortalama değil orta değer ve yüzdelik kullanılır: birkaç uç ilan aralığı kaydıramaz.
 *
 * Ölçüm (14 Ekim 2026, scratch/loo-sell-prod.ts, üretim yolu): 53.033 aktif ilanın 1.500'ü rastgele seçildi; her ilan kendi kimliği
 * hariç tutularak, formda girilmiş gibi kıyaslandı. Güvenilir aralık çıkan ilanların %76,9'unda; yüksek uç engeli %0,1, düşük uç
 * engeli %0,1 (temiz ilanlarda %0,2), uyarı %4,5; ilanın kendi fiyatı aralığın içinde %51. Hasarlı ilanlar örneklemin %2,8'i ve
 * bunların yalnızca %12'sinde aralık çıktı: emsal sayısı az, bu yüzden hasarlı araçta aralık çoğu zaman gösterilmez.
 */
export const SELL_RULES = {
  /** Aralık gösterilmesi için en az bu kadar emsal. */
  minComparables: 10,
  /** (p75 − p25) / orta değer: bu değerden dağınık aralık gösterilmez. */
  maxSpread: 0.35,
  /** Fiyat orta değerin bu katından yüksekse engellenir. */
  highBlock: 2.5,
  /** Fiyat orta değerin bu katından düşükse engellenir (yalnızca hasar durumu bildirildiyse). */
  lowBlock: 0.4,
  /** Aralığın bu oranının altı / üstü yalnızca uyarıdır. */
  warnLow: 0.8,
  warnHigh: 1.2,
} as const;

/** Form ve API'nin kabul ettiği hasar durumları. */
export const SELL_DAMAGE_OPTIONS = ["orijinal", "boyali", "hasarli"] as const;
export type SellDamage = (typeof SELL_DAMAGE_OPTIONS)[number];

/**
 * Etiketler, veri kaynaklarındaki `damageFlag` anlamına göre yazıldı: kaynaklar bu alanı çoğunlukla tramer (hasar) kaydı için
 * işaretliyor, yalnızca ağır hasar için değil (enrich-detail.ts: tramer.status "record" → damageFlag true).
 */
export const SELL_DAMAGE_LABELS: Record<SellDamage, string> = {
  orijinal: "Hasar kaydı yok, boyasız (orijinal)",
  boyali: "Hasar kaydı yok, boyalı veya değişen parça var",
  hasarli: "Hasar kaydı var (tramer veya ağır hasar)",
};

/** Hasar durumunun ilanda yazılan metni. Hasarlı ilanda boya bilgisi yoktur, metin boş kalır. */
export const SELL_DAMAGE_PAINT_TEXT = {
  orijinal: "Tamamı orjinal",
  boyali: "Boyalı veya değişen parça var",
} as const;

export const ENGINE_MIN_LITRE = 0.6;
export const ENGINE_MAX_LITRE = 8;

export function parseSellDamage(value: unknown): SellDamage | null {
  const text = String(value ?? "");
  return (SELL_DAMAGE_OPTIONS as readonly string[]).includes(text) ? (text as SellDamage) : null;
}

/** Hasar alanı isteğe bağlı: boşsa "bilinmiyor" (null). Eski mobil sürümler bu alanı göndermez. */
export function parseListingDamage(raw: unknown): { ok: true; value: SellDamage | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const value = parseSellDamage(raw);
  return value ? { ok: true, value } : { ok: false, error: "Hasar durumu geçersiz." };
}

/** Motor hacmi (litre, "1,6" ya da "1.6"). Boşsa null. Elektrikli araçta anlamsız olduğu için çağıran taraf yok sayar. */
export function parseEngineSize(raw: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const text = String(raw).trim().replace(",", ".");
  if (!text) return { ok: true, value: null };
  const value = Number(text);
  if (!Number.isFinite(value) || value < ENGINE_MIN_LITRE || value > ENGINE_MAX_LITRE) {
    return { ok: false, error: `Motor hacmi ${ENGINE_MIN_LITRE.toLocaleString("tr-TR")} ile ${ENGINE_MAX_LITRE.toLocaleString("tr-TR")} litre arasında olmalı.` };
  }
  return { ok: true, value: Math.round(value * 10) / 10 };
}

export function isElectricFuel(fuelType: string): boolean {
  return /elektrik/i.test(fuelType);
}

/** Form seçiminden ilan alanlarına. Boya metni skalada boya olarak okunur (derivePainted). */
export function damageToFields(damage: SellDamage): { damageFlag: boolean; paintChange: string } {
  if (damage === "hasarli") return { damageFlag: true, paintChange: "" };
  return { damageFlag: false, paintChange: SELL_DAMAGE_PAINT_TEXT[damage] };
}

/** Kayıtlı ilanın hasar durumu (düzenleme formunu doldurmak ve kıyası seçmek için). Bilinmiyorsa null. */
export function storedDamage(doc: { damageFlag?: boolean | null; paintChange?: string | null }): SellDamage | null {
  if (doc.damageFlag === true) return "hasarli";
  const paint = (doc.paintChange ?? "").trim();
  if (paint === SELL_DAMAGE_PAINT_TEXT.orijinal) return "orijinal";
  if (paint === SELL_DAMAGE_PAINT_TEXT.boyali) return "boyali";
  return null;
}

export interface SellSubjectInput {
  brand: string;
  model: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  engineSize: number | null;
  damage: SellDamage | null;
  /** Düzenlenen ilanın kimliği: aralık hesaplanırken kendi ilanı emsal sayılmaz. */
  excludeId: string | null;
}

const TRANSMISSION_OPTIONS = ["Manuel", "Otomatik"] as const;

/** Fiyat aralığı isteğinin doğrulanmış hâli. Hatalıysa kullanıcıya gösterilecek metin döner. */
export function parseSellSubject(
  body: Record<string, unknown>,
  now = new Date().getFullYear()
): { ok: true; value: SellSubjectInput } | { ok: false; error: string } {
  const brand = String(body.brand ?? "").trim();
  const model = String(body.model ?? "").trim();
  if (!brand || !model) return { ok: false, error: "Marka ve model zorunludur." };

  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 1950 || year > now + 1) {
    return { ok: false, error: `Yıl 1950 ile ${now + 1} arasında olmalıdır.` };
  }

  const mileage = Number(body.mileage);
  if (!Number.isFinite(mileage) || mileage < 0 || mileage > 2_000_000) {
    return { ok: false, error: "Kilometre geçerli bir aralıkta olmalıdır." };
  }

  const fuelType = normalizeFuelType(String(body.fuelType ?? ""));
  if (!(FUEL_TYPES as readonly string[]).includes(fuelType)) return { ok: false, error: "Yakıt tipini seç." };

  const transmission = String(body.transmission ?? "");
  if (!(TRANSMISSION_OPTIONS as readonly string[]).includes(transmission)) return { ok: false, error: "Vites tipini seç." };

  const damage = parseListingDamage(body.damage);
  if (!damage.ok) return { ok: false, error: damage.error };

  const engine = parseEngineSize(body.engineSize);
  if (!engine.ok) return { ok: false, error: engine.error };

  const excludeId = typeof body.excludeId === "string" && /^[a-f0-9]{24}$/i.test(body.excludeId) ? body.excludeId : null;

  return {
    ok: true,
    value: {
      brand,
      model,
      year,
      mileage: Math.round(mileage),
      fuelType,
      transmission,
      engineSize: isElectricFuel(fuelType) ? null : engine.value,
      damage: damage.value,
      excludeId,
    },
  };
}

export interface SellEstimateTier {
  key: string;
  label: string;
  n: number;
  p25: number;
  median: number;
  p75: number;
}

export interface SellEstimate {
  confident: boolean;
  /** Aralık gösterilmediğinde kullanıcıya gösterilecek kısa neden. */
  reason: string;
  tier: SellEstimateTier | null;
}

const TIER_ORDER = ["tam", "donanim", "km"] as const;

/**
 * Kademelerden ilk uygun olanı seçer (tam → donanım → km). Uygun: en az minComparables emsal. Uygun kademe dağınıksa aralık
 * gösterilmez ve daha geniş kademeye düşülmez: dağınık emsalden aralık çıkmaz.
 * Aile kademesi (yıl ±3, donanım ve km yok) satıcıya hiç kullanılmaz.
 */
export function chooseSellEstimate(scale: PriceScale): SellEstimate {
  for (const key of TIER_ORDER) {
    const tier = scale.tiers.find((t) => t.key === key);
    if (!tier || !tier.usable || tier.p25 === null || tier.p75 === null || tier.median === null) continue;
    if (tier.n < SELL_RULES.minComparables) continue;
    const spread = (tier.p75 - tier.p25) / tier.median;
    if (spread > SELL_RULES.maxSpread) {
      return { confident: false, reason: "Benzer araçların fiyatları çok dağınık; fiyat aralığı gösterilmiyor.", tier: null };
    }
    return {
      confident: true,
      reason: "",
      tier: { key: tier.key, label: tier.label, n: tier.n, p25: tier.p25, median: tier.median, p75: tier.p75 },
    };
  }
  return { confident: false, reason: "Bu araç için yeterli benzer ilan yok; fiyat aralığı gösterilmiyor.", tier: null };
}

export type GuardLevel = "none" | "warn" | "block";
export interface PriceGuard {
  level: GuardLevel;
  message: string | null;
}

const tl = (value: number) => `${Math.round(value).toLocaleString("tr-TR")} TL`;
const ratio = (value: number) => value.toLocaleString("tr-TR");

/**
 * Girilen fiyat için kural. Yalnızca güvenilir aralık varken devreye girer. Sunucu kayıt sırasında aynı fonksiyonu çalıştırır.
 */
export function priceGuard(price: number, estimate: SellEstimate, options: { damageKnown: boolean }): PriceGuard {
  const none: PriceGuard = { level: "none", message: null };
  if (!estimate.confident || !estimate.tier || !(price > 0)) return none;
  const { median, p25, p75 } = estimate.tier;

  if (price >= median * SELL_RULES.highBlock) {
    return {
      level: "block",
      message: `Girdiğin fiyat (${tl(price)}), benzer araçların orta değeri olan ${tl(median)} değerinin ${ratio(SELL_RULES.highBlock)} katından yüksek. Fiyatı kontrol et.`,
    };
  }
  if (options.damageKnown && price <= median * SELL_RULES.lowBlock) {
    return {
      level: "block",
      message: `Girdiğin fiyat (${tl(price)}), benzer araçların orta değeri olan ${tl(median)} değerinin %${Math.round(SELL_RULES.lowBlock * 100)}'ından düşük. Fiyatı ve hasar durumunu kontrol et.`,
    };
  }
  if (price < p25 * SELL_RULES.warnLow || price > p75 * SELL_RULES.warnHigh) {
    return {
      level: "warn",
      message: `Girdiğin fiyat, benzer araçların çoğunun aralığının (${tl(p25)} – ${tl(p75)}) dışında. Bilinçli bir tercihse devam edebilirsin.`,
    };
  }
  return none;
}

/** Yıl ve kilometre tutarlılığı: bariz hatalı girişleri uyarır (engellemez). */
export function yearMileageWarnings(year: number, mileage: number, now = new Date().getFullYear()): string[] {
  const warnings: string[] = [];
  if (year > now + 1) warnings.push("Model yılı gelecekte görünüyor.");
  const age = Math.max(0, now - year);
  if (mileage / Math.max(1, age + 1) > 60_000) {
    warnings.push("Kilometre, yaşına göre çok yüksek görünüyor. Kontrol et.");
  }
  if (age >= 3 && mileage < 1_000) {
    warnings.push("Kilometre, yaşına göre çok düşük görünüyor. Kontrol et.");
  }
  return warnings;
}
