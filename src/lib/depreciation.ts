import { fitLinear } from "@/lib/price-prediction";

/**
 * DEĞER KAYBI: bir modelin fiyatının yaşa, kilometreye ve hasar/boya durumuna göre nasıl değiştiği.
 * Yıllık ortalama fiyat eğrisi tek başına yanıltıcıdır: yeni araçlar daha az kilometreli, hasarlılar daha eski
 * olabilir. Bu yüzden log(fiyat) = a + b₁·yaş + b₂·(km/10 bin) + b₃·hasarlı + b₄·boyalı regresyonu kurulur; her
 * etki diğerlerinden arındırılmış çıkar ("aynı yaş ve km'de hasarlı araç %X daha ucuz").
 */

export type CarCondition = "clean" | "painted" | "damaged";
export type ConditionFilter = "all" | CarCondition;

export const CONDITION_LABELS: Record<CarCondition, string> = {
  clean: "Hasarsız",
  painted: "Boyalı / değişen",
  damaged: "Hasar kayıtlı",
};

export interface DepreciationRow {
  year: number;
  mileage: number;
  price: number;
  condition: CarCondition;
}

export interface DepreciationEffects {
  /** Aynı km ve durumda her ek yaşın fiyata etkisi (% olarak kayıp). */
  annualLossPct: number | null;
  /** Aynı yaşta her 10.000 km'nin kayıp yüzdesi. */
  per10kKmLossPct: number | null;
  /** Yaşın etkisi + yılda ortalama 15.000 km'nin etkisi: bir yıl bekleyen aracın pratikte toplam kaybı. */
  typicalAnnualLossPct: number | null;
  /** Hasar kayıtlı aracın, hasarsız eşdeğerine göre fiyat farkı (% , eksi = daha ucuz). */
  damagePct: number | null;
  /** Boyalı/değişenli aracın hasarsız eşdeğerine göre fiyat farkı. */
  paintPct: number | null;
  /** Regresyonun örnek sayısı ve açıklama gücü. */
  sample: number;
  r2: number | null;
}

export const MIN_EFFECT_SAMPLE = 15;
/** Bir durumun etkisini göstermek için o durumdan en az bu kadar ilan gerekir. */
export const MIN_CONDITION_SAMPLE = 3;

const round1 = (value: number) => Math.round(value * 10) / 10;

export function conditionOfRow(car: { damageFlag?: boolean; paintChange?: string }, derivePainted: (p?: string) => number): CarCondition {
  if (car.damageFlag) return "damaged";
  return derivePainted(car.paintChange) > 0 ? "painted" : "clean";
}

/** Etkileri hesaplar; örnek yetersizse ya da hesap tutarsızsa ilgili alan null kalır (uydurma rakam yok). */
export function modelEffects(rows: DepreciationRow[], now = new Date()): DepreciationEffects {
  const empty: DepreciationEffects = { annualLossPct: null, per10kKmLossPct: null, typicalAnnualLossPct: null, damagePct: null, paintPct: null, sample: rows.length, r2: null };
  const usable = rows.filter((r) => r.price > 0 && r.year > 1980 && r.mileage >= 0);
  if (usable.length < MIN_EFFECT_SAMPLE) return empty;

  const thisYear = now.getFullYear();
  const damagedN = usable.filter((r) => r.condition === "damaged").length;
  const paintedN = usable.filter((r) => r.condition === "painted").length;
  const useDamage = damagedN >= MIN_CONDITION_SAMPLE;
  const usePaint = paintedN >= MIN_CONDITION_SAMPLE;

  const X = usable.map((r) => {
    const row = [1, Math.max(0, thisYear - r.year), r.mileage / 10_000];
    if (useDamage) row.push(r.condition === "damaged" ? 1 : 0);
    if (usePaint) row.push(r.condition === "painted" ? 1 : 0);
    return row;
  });
  const fit = fitLinear(X, usable.map((r) => Math.log(r.price)), 1e-6);
  if (!fit) return empty;

  let next = 3;
  const [, bAge, bKm] = fit.coeffs;
  const bDamage = useDamage ? fit.coeffs[next++] : null;
  const bPaint = usePaint ? fit.coeffs[next] : null;

  // Yaş ve km'nin fiyatı artırdığı (eksi kayıp) sonuç veri gürültüsüdür: gösterilmez.
  const loss = (b: number) => (1 - Math.exp(b)) * 100;
  const annual = loss(bAge);
  const perKm = loss(bKm);
  const annualOk = annual > 0 && annual < 60;
  const perKmOk = perKm > 0 && perKm < 40;
  // Yılda ortalama 15.000 km: 1,5 × (10 bin km etkisi).
  const typical = annualOk && perKmOk ? (1 - Math.exp(bAge) * Math.exp(bKm * 1.5)) * 100 : null;
  return {
    annualLossPct: annualOk ? round1(annual) : null,
    per10kKmLossPct: perKmOk ? round1(perKm) : null,
    typicalAnnualLossPct: typical !== null && typical > 0 && typical < 70 ? round1(typical) : null,
    damagePct: bDamage !== null && bDamage < 0 ? round1((Math.exp(bDamage) - 1) * 100) : null,
    paintPct: bPaint !== null && bPaint < 0 ? round1((Math.exp(bPaint) - 1) * 100) : null,
    sample: usable.length,
    r2: Number.isFinite(fit.r2) ? Math.round(fit.r2 * 100) / 100 : null,
  };
}

export interface ConditionCurvePoint {
  year: number;
  clean?: number;
  painted?: number;
  damaged?: number;
}

/** Model yılına göre ortalama fiyat, durum başına ayrı seri (her yılda her durumdan en az 2 ilan varsa nokta olur). */
export function conditionCurves(rows: DepreciationRow[]): ConditionCurvePoint[] {
  const byYear = new Map<number, Record<CarCondition, number[]>>();
  for (const r of rows) {
    if (!r.year || r.price <= 0) continue;
    const bucket = byYear.get(r.year) ?? { clean: [], painted: [], damaged: [] };
    bucket[r.condition].push(r.price);
    byYear.set(r.year, bucket);
  }
  const avg = (v: number[]) => (v.length >= 2 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : undefined);
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, b]) => ({ year, clean: avg(b.clean), painted: avg(b.painted), damaged: avg(b.damaged) }))
    .filter((p) => p.clean !== undefined || p.painted !== undefined || p.damaged !== undefined);
}
