import { mileageWindow } from "@/lib/comparables";

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
 * ("GT Line", "M Sport") yapısal bir alan değildir, o yüzden eşleşmede kullanılmaz.
 */

export interface ScaleCar {
  price: number;
  year: number;
  mileage: number;
  damaged: boolean;
  engineSize?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  horsepower?: number | null;
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
  tiers: PriceScaleTier[];
  chosen: TierKey | null;
  /** Seçili kademenin fiyatları (en fazla 60 nokta, sıralı): grafiği çizmek için. */
  sample: number[];
}

export interface PackageKey {
  /** Motor hacmi (litre). Elektrikli araçlarda 0. */
  engine: number;
  fuel: "benzin" | "dizel" | "lpg" | "hibrit" | "elektrik";
  gear: "manuel" | "otomatik" | "yari";
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
  if (value.startsWith("yarı") || value.startsWith("yari")) return "yari";
  if (value === "otomatik" || value === "tiptronik" || value === "multitronic") return "otomatik";
  return null;
}

/** Donanım anahtarı. Yakıt ya da vites bilinmiyorsa donanım eşleşmesi yapılamaz (null). */
export function packageKey(car: ScaleCar): PackageKey | null {
  const fuel = fuelGroup(car.fuelType);
  const gear = gearGroup(car.transmission);
  if (!fuel || !gear) return null;
  const engine = fuel === "elektrik" ? 0 : car.engineSize && car.engineSize >= 0.5 ? Math.round(car.engineSize * 10) / 10 : null;
  if (engine === null) return null;
  return { engine, fuel, gear, horsepower: car.horsepower && car.horsepower > 0 ? car.horsepower : null };
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

function emptyTier(rule: TierRule, n: number, note: string | null): PriceScaleTier {
  return {
    key: rule.key,
    label: rule.label,
    n,
    minN: rule.minN,
    usable: false,
    note,
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
  const subjectPackage = packageKey(subject);
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
    if (!prices) return emptyTier(rule, 0, note);
    if (prices.length < rule.minN) return emptyTier(rule, prices.length, `en az ${rule.minN} ilan gerekli`);
    return tierStats(rule, prices, subject.price);
  });

  const chosenIndex = tiers.findIndex((tier) => tier.usable);
  return {
    listingPrice: subject.price,
    packageKnown: Boolean(subjectPackage),
    tiers,
    chosen: chosenIndex >= 0 ? tiers[chosenIndex].key : null,
    sample: chosenIndex >= 0 ? evenSample(matched[chosenIndex].prices ?? []) : [],
  };
}
