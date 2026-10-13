import { mileageWindow } from "@/lib/comparables";
import { engineFromText } from "@/lib/fuel-cost";

/**
 * FİYAT SKALASI: bir ilanın emsallerini, en yakından en uzağa doğru kademeler hâlinde gösterir.
 *
 * Emsal kademeleri (yukarıdan aşağıya, ilk yeterli kademe seçilir): aynı model ailesi içinde
 *  1) tam eşleşme: yıl ±1, km penceresi içinde, aynı hasar durumu ve aynı donanım (motor, yakıt, vites, beygir),
 *  2) donanım eşleşmesi: yıl ±2, km penceresi geniş, aynı donanım,
 *  3) km yakın: yıl ±2, kilometre penceresi içinde (hasar ve donanım şartı yok),
 *  4) model ailesi: yıl ±3 (son çare).
 *
 * Donanım, yapısal veriden okunur: motor hacmi (litre), yakıt grubu, vites grubu ve beygir (±%10). Başlıktaki paket adı
 * ("GT Line", "M Sport") yapısal bir alan değildir, o yüzden eşleşmede kullanılmaz. İlanda yalnızca motor hacmi yoksa (üye
 * ilanı formunda isteğe bağlı), yakıt ve vitesi aynı emsallerin baskın (≥%80) motoru esas alınır ve kartta belirtilir.
 */

export interface ScaleCar {
  price: number;
  year: number;
  mileage: number;
  damaged: boolean;
  city?: string | null;
  engineSize?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  horsepower?: number | null;
  /** Motor hacmi önce model/başlık metninden okunur ("1.6 TGDI"): kaynakların yapısal alanı birbirini tutmuyor (bkz. packageKey). */
  model?: string | null;
  title?: string | null;
}

/**
 * Aynı aracın birden fazla kez yayınlanması (aynı model, yıl, km, fiyat ve şehir) emsal sayısını ve ortalamayı şişirir.
 * İlanın kendisiyle aynı olanlar ve tekrarların ikincisi ve sonrası emsal sayılmaz; veri değiştirilmez.
 */
export function dedupeCandidates<T extends ScaleCar>(subject: ScaleCar, candidates: T[]): T[] {
  const keyOf = (car: ScaleCar) => [car.year, car.mileage, car.price, car.city ?? ""].join("|");
  const seen = new Set<string>([keyOf(subject)]);
  return candidates.filter((candidate) => {
    const key = keyOf(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type TierKey = "tam" | "donanim" | "km" | "aile";

export interface PriceScaleTier {
  key: TierKey;
  label: string;
  n: number;
  minN: number;
  usable: boolean;
  /** Kademe kullanılamıyorsa nedeni (ör. "en az 5 ilan gerekli", "donanım bilgisi eksik"). */
  note: string | null;
  /** Donanım kademesi, ilanda motor/yakıt/vites bilgisi olmadığı için hiç hesaplanamadı (emsal sayısı 0 değil, bilinmiyor). */
  missingPackage: boolean;
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  max: number | null;
  mean: number | null;
  /** Emsallerin yüzde kaçı bu ilanın fiyatından daha ucuz (ilanın konumu). */
  cheaperPct: number | null;
  /** İlanın fiyatının medyana göre farkı, yüzde (negatif: medyanın altında). */
  medianDiffPct: number | null;
}

export interface PriceScale {
  listingPrice: number;
  packageKnown: boolean;
  /** İlanda motor hacmi yazmıyorsa, emsallerin baskın motoru (litre); donanım kademeleri bununla hesaplanır. */
  inferredEngine: number | null;
  tiers: PriceScaleTier[];
  chosen: TierKey | null;
  /** Seçili kademenin fiyatları (en fazla 60 nokta, sıralı): grafiği çizmek için. */
  sample: number[];
}

export interface PackageKey {
  /** Motor hacmi (litre). Elektrikli araçlarda 0. */
  engine: number;
  fuel: "benzin" | "dizel" | "lpg" | "hibrit" | "elektrik";
  gear: "manuel" | "otomatik";
  horsepower: number | null;
}

export interface TierRule {
  key: TierKey;
  label: string;
  yearGap: number;
  kmWindow: ((km: number) => number) | null;
  sameDamage: boolean;
  samePackage: boolean;
  minN: number;
}

export const SCALE_TIERS: readonly TierRule[] = [
  {
    key: "tam",
    label: "Aynı yıl, km, hasar ve donanım",
    yearGap: 1,
    kmWindow: (km) => Math.max(15_000, Math.round(km * 0.2)),
    sameDamage: true,
    samePackage: true,
    minN: 5,
  },
  {
    key: "donanim",
    label: "Aynı donanım, yıl ±2, km yakın",
    yearGap: 2,
    kmWindow: (km) => Math.max(30_000, Math.round(km * 0.4)),
    sameDamage: false,
    samePackage: true,
    minN: 5,
  },
  {
    key: "km",
    label: "Yıl ±2 ve km yakın",
    yearGap: 2,
    kmWindow: mileageWindow,
    sameDamage: false,
    samePackage: false,
    minN: 5,
  },
  {
    key: "aile",
    label: "Model ailesi, yıl ±3",
    yearGap: 3,
    kmWindow: null,
    sameDamage: false,
    samePackage: false,
    minN: 3,
  },
];

const SAMPLE_LIMIT = 60;

/** Sıralı fiyat dizisinin medyanı (çift sayıda ise iki orta değerin ortalaması). */
export function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Yüzdelik değer (en yakın sıra yöntemi). Dizi sıralı olmalı. */
export function quantile(sorted: number[], q: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function fuelGroup(raw?: string | null): PackageKey["fuel"] | null {
  const value = (raw || "").trim().toLocaleLowerCase("tr-TR");
  if (!value || value === "bilinmiyor") return null;
  if (value.startsWith("lpg")) return "lpg";
  if (value.startsWith("dizel")) return "dizel";
  if (value.startsWith("benzin")) return "benzin";
  if (value.startsWith("hibrit")) return "hibrit";
  if (value.startsWith("elektrik")) return "elektrik";
  return null;
}

function gearGroup(raw?: string | null): PackageKey["gear"] | null {
  const value = (raw || "").trim().toLocaleLowerCase("tr-TR");
  if (!value || value === "bilinmiyor") return null;
  if (value.startsWith("manuel")) return "manuel";
  // "Yarı otomatik" ve "otomatik" aynı grup: kaynaklar aynı aracı iki adla yazıyor (Tiggo 7 Pro DCT: 45 ilan "Yarı Otomatik", 14 "Otomatik"),
  // alıcı için ikisi de pedalsız şanzıman (bkz. transmission-label.ts); fiyat tahmini de aynı grupta sayar (gearIndicator).
  if (value.startsWith("yarı") || value.startsWith("yari")) return "otomatik";
  if (value === "otomatik" || value === "tiptronik" || value === "multitronic") return "otomatik";
  return null;
}

/**
 * Motor hacmi (litre): elektrikli araçta 0; diğerlerinde önce başlık/modeldeki hacim ("1.6 TGDI"), yoksa kaydedilen alan. Yakıt maliyeti de
 * böyle okur: aynı "1.6 TGDI" ilanı bir kaynakta 1,6, öbüründe 1,4 kayıtlı olabiliyor ve aileyi sahte donanımlara böler.
 */
function engineOf(car: ScaleCar, fuel: PackageKey["fuel"]): number | null {
  if (fuel === "elektrik") return 0;
  return engineFromText(car.model, car.title) ?? (car.engineSize && car.engineSize >= 0.5 ? Math.round(car.engineSize * 10) / 10 : null);
}

/** Donanım anahtarı. Yakıt ya da vites bilinmiyorsa donanım eşleşmesi yapılamaz (null). */
export function packageKey(car: ScaleCar): PackageKey | null {
  const fuel = fuelGroup(car.fuelType);
  const gear = gearGroup(car.transmission);
  if (!fuel || !gear) return null;
  const engine = engineOf(car, fuel);
  if (engine === null) return null;
  return { engine, fuel, gear, horsepower: car.horsepower && car.horsepower > 0 ? car.horsepower : null };
}

/** Çıkarım için en az bu kadar uyumlu emsal ve bunların en az bu kadarı aynı motorda olmalı. */
const INFER_MIN_N = 5;
const INFER_DOMINANCE = 0.8;

/**
 * İlanda motor hacmi yazmıyorsa (üye ilanı formunda isteğe bağlı), yakıt ve vitesi aynı olan yakın yıllı emsallerin baskın (≥%80)
 * motoruyla tamamlanmış donanım anahtarı. Yakıt ya da vites bilinmiyorsa, motor zaten biliniyorsa ya da emsaller karışıksa null:
 * yanlış paketle kıyaslamaktansa donanım kademesi hesaplanmaz. Beygir tamamlanmaz (donanım eşleşmesi onu yoksayar).
 */
export function inferPackage(subject: ScaleCar, candidates: ScaleCar[]): PackageKey | null {
  const fuel = fuelGroup(subject.fuelType);
  const gear = gearGroup(subject.transmission);
  if (!fuel || !gear || fuel === "elektrik") return null;
  if (engineOf(subject, fuel) !== null) return null;
  const counts = new Map<number, number>();
  let compatible = 0;
  for (const candidate of candidates) {
    if (Math.abs(candidate.year - subject.year) > 2) continue;
    const key = packageKey(candidate);
    if (!key || key.fuel !== fuel || key.gear !== gear) continue;
    compatible += 1;
    counts.set(key.engine, (counts.get(key.engine) ?? 0) + 1);
  }
  if (compatible < INFER_MIN_N) return null;
  const [engine, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n / compatible < INFER_DOMINANCE) return null;
  return { engine, fuel, gear, horsepower: null };
}

export function samePackage(a: PackageKey, b: PackageKey): boolean {
  if (a.engine !== b.engine || a.fuel !== b.fuel || a.gear !== b.gear) return false;
  if (a.horsepower && b.horsepower) {
    const allowed = Math.max(a.horsepower, b.horsepower) * 0.1;
    return Math.abs(a.horsepower - b.horsepower) <= allowed;
  }
  return true;
}

/** Bir emsal adayının kademe kuralına uyup uymadığı. */
export function matchesTier(
  rule: TierRule,
  subject: ScaleCar,
  subjectPackage: PackageKey | null,
  candidate: ScaleCar
): boolean {
  if (candidate.price <= 0) return false;
  if (Math.abs(candidate.year - subject.year) > rule.yearGap) return false;
  const window = rule.kmWindow ? rule.kmWindow(subject.mileage) : null;
  if (window !== null && Math.abs(candidate.mileage - subject.mileage) > window) return false;
  if (rule.sameDamage && candidate.damaged !== subject.damaged) return false;
  if (rule.samePackage) {
    const candidatePackage = packageKey(candidate);
    return Boolean(candidatePackage && subjectPackage && samePackage(subjectPackage, candidatePackage));
  }
  return true;
}

function emptyTier(rule: TierRule, n: number, note: string | null, missingPackage = false): PriceScaleTier {
  return {
    key: rule.key,
    label: rule.label,
    n,
    minN: rule.minN,
    usable: false,
    note,
    missingPackage,
    min: null,
    p25: null,
    median: null,
    p75: null,
    max: null,
    mean: null,
    cheaperPct: null,
    medianDiffPct: null,
  };
}

/** Emsal fiyatlarından kademe istatistiklerini ve ilanın konumunu hesaplar. Fiyatlar sıralı olmalı. */
function tierStats(rule: TierRule, sorted: number[], listingPrice: number): PriceScaleTier {
  const n = sorted.length;
  const med = median(sorted);
  const cheaper = sorted.filter((p) => p < listingPrice).length;
  return {
    key: rule.key,
    label: rule.label,
    n,
    minN: rule.minN,
    usable: true,
    note: null,
    missingPackage: false,
    min: sorted[0],
    p25: quantile(sorted, 0.25),
    median: Math.round(med),
    p75: quantile(sorted, 0.75),
    max: sorted[n - 1],
    mean: Math.round(sorted.reduce((sum, p) => sum + p, 0) / n),
    cheaperPct: Math.round((cheaper / n) * 100),
    medianDiffPct: Math.round(((listingPrice - med) / med) * 100),
  };
}

/** Çok fazla nokta olursa eşit aralıklı en fazla 60 nokta. */
export function evenSample(sorted: number[]): number[] {
  if (sorted.length <= SAMPLE_LIMIT) return sorted;
  const step = (sorted.length - 1) / (SAMPLE_LIMIT - 1);
  return Array.from({ length: SAMPLE_LIMIT }, (_, i) => sorted[Math.round(i * step)]);
}

/**
 * İlanın fiyat skalasını kurar. `candidates` aynı model ailesinden, en fazla ±3 yıl içindeki yayındaki ilanlardır (sorgu
 * tarafında süzülür); kademe kuralları burada uygulanır. İlanın kendisi aday listesinde olmamalıdır.
 */
export function buildPriceScale(subject: ScaleCar, candidates: ScaleCar[]): PriceScale {
  const ownPackage = packageKey(subject);
  const inferred = ownPackage ? null : inferPackage(subject, candidates);
  const subjectPackage = ownPackage ?? inferred;
  const matched = SCALE_TIERS.map((rule) => {
    if (rule.samePackage && !subjectPackage) {
      return { rule, prices: null, note: "donanım bilgisi (motor, yakıt, vites) eksik" };
    }
    const prices = candidates
      .filter((candidate) => matchesTier(rule, subject, subjectPackage, candidate))
      .map((candidate) => candidate.price)
      .sort((a, b) => a - b);
    return { rule, prices, note: null };
  });

  const tiers = matched.map(({ rule, prices, note }) => {
    if (!prices) return emptyTier(rule, 0, note, true);
    if (prices.length < rule.minN) return emptyTier(rule, prices.length, `en az ${rule.minN} ilan gerekli`);
    return tierStats(rule, prices, subject.price);
  });

  const chosenIndex = tiers.findIndex((tier) => tier.usable);
  return {
    listingPrice: subject.price,
    packageKnown: Boolean(subjectPackage),
    inferredEngine: inferred ? inferred.engine : null,
    tiers,
    chosen: chosenIndex >= 0 ? tiers[chosenIndex].key : null,
    sample: chosenIndex >= 0 ? evenSample(matched[chosenIndex].prices ?? []) : [],
  };
}
