import { Car } from "@/models/Car";
import { cached } from "@/lib/cache";
import { modelFamily, modelFamilyRegex } from "@/lib/model-family";
import { brandStorageAliases } from "@/lib/normalize-brand";
import { turkishSearchRegex } from "@/lib/utils";

/**
 * PİYASA TEMPOSU: benzer ilanlar kaç günde yayından kalkıyor ve satıcılar yayındayken ne kadar indirim yapıyor.
 * Kaynak: bekçinin ve envanter senkronlarının "kaynakta kaldırıldı" diye arşive aldığı ilanlar (arşiv tarihi ve
 * gerekçesi olanlar) ile fiyat geçmişleri. Kaldırılma "satıldı" demek değildir (satıcı da kaldırabilir); metinler
 * bunu "yayından kalkma" diye anlatır. Örnek azsa sonuç verilmez (uydurma yok), daha geniş segmente düşülür.
 */

export interface MarketTempo {
  /** Yayından kalkma süresi (gün): ortanca ve çeyrekler. */
  days: { median: number; p25: number; p75: number; sample: number } | null;
  /** Yayındayken fiyat indiren ilan oranı ve indirim yapanların ortanca indirimi (%). */
  drop: { share: number; medianPct: number; sample: number } | null;
  /** Hesabın yapıldığı grup ("Fiat Egea 2019-2023", "Fiat geneli"). */
  scopeLabel: string;
}

export const TEMPO_MIN_DAYS_SAMPLE = 12;
export const TEMPO_MIN_DROP_SAMPLE = 20;

const MONTHS: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4, haziran: 5, temmuz: 6,
  ağustos: 7, agustos: 7, eylül: 8, eylul: 8, ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

/** "19 Eylül 2026" → Date (Türkiye günü başlangıcı). Okunamazsa null. */
export function parseTrDate(text?: string | null): Date | null {
  const m = (text || "").trim().toLocaleLowerCase("tr-TR").match(/^(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (month === undefined) return null;
  const date = new Date(Date.UTC(Number(m[3]), month, Number(m[1])) - 3 * 60 * 60 * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface TempoDoc {
  createdAt?: Date;
  listingDate?: string;
  removedAt?: Date;
  lastVerifiedAt?: Date;
  price?: number;
  priceHistory?: Array<{ price: number }>;
}

const DAY = 24 * 60 * 60 * 1000;

/** Yayında kalma süresi (gün). Kaldırılma anı son "canlı görüldü" ile arşiv anı arasındadır: ortası alınır. */
export function daysOnMarket(doc: TempoDoc): number | null {
  if (!doc.removedAt) return null;
  const start = parseTrDate(doc.listingDate) || doc.createdAt;
  if (!start) return null;
  const removed = new Date(doc.removedAt).getTime();
  const lastSeen = doc.lastVerifiedAt ? new Date(doc.lastVerifiedAt).getTime() : NaN;
  const end = Number.isFinite(lastSeen) && lastSeen < removed ? lastSeen + (removed - lastSeen) / 2 : removed;
  const days = (end - new Date(start).getTime()) / DAY;
  return days >= 0 && days <= 365 ? days : null;
}

/** İlk fiyattan bugünkü fiyata indirim yüzdesi (indirim yoksa 0). */
export function priceDropPct(doc: TempoDoc): number | null {
  const history = doc.priceHistory || [];
  if (history.length < 2) return null;
  const first = history[0]?.price;
  const current = doc.price ?? history[history.length - 1]?.price;
  if (!(first > 0) || !(current > 0)) return null;
  const pct = ((first - current) / first) * 100;
  // %60'ı aşan "indirim" fiyatın hatalı girilip düzeltilmesidir, pazarlık değil.
  return pct >= 1 && pct <= 60 ? pct : 0;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summarizeTempo(removed: TempoDoc[], withHistory: TempoDoc[], scopeLabel: string): MarketTempo {
  const days = removed.map(daysOnMarket).filter((d): d is number => d !== null).sort((a, b) => a - b);
  const drops = withHistory.map(priceDropPct).filter((d): d is number => d !== null);
  const dropped = drops.filter((d) => d > 0).sort((a, b) => a - b);
  return {
    days:
      days.length >= TEMPO_MIN_DAYS_SAMPLE
        ? {
            median: Math.round(quantile(days, 0.5)),
            p25: Math.round(quantile(days, 0.25)),
            p75: Math.round(quantile(days, 0.75)),
            sample: days.length,
          }
        : null,
    drop:
      drops.length >= TEMPO_MIN_DROP_SAMPLE
        ? {
            share: Math.round((dropped.length / drops.length) * 100),
            medianPct: dropped.length ? Math.round(quantile(dropped, 0.5) * 10) / 10 : 0,
            sample: drops.length,
          }
        : null,
    scopeLabel,
  };
}

/** Kaynakta kaldırıldığı için arşive giden ilanlar (yöneticinin, kapsam dışı ya da eksik diye arşivledikleri hariç). */
const GONE_FROM_SOURCE = {
  removedAt: { $type: "date" },
  $and: [
    { removedReason: { $regex: "^[a-z]+: " } },
    { removedReason: { $not: /platform dışı|otomobil ilanı değil|eksik|manuel/i } },
  ],
};

const FIELDS = "createdAt listingDate removedAt lastVerifiedAt price priceHistory";

async function tempoFor(filter: Record<string, unknown>, label: string): Promise<MarketTempo> {
  const [removed, withHistory] = await Promise.all([
    Car.find({ ...filter, status: "removed", ...GONE_FROM_SOURCE }).select(FIELDS).sort({ removedAt: -1 }).limit(600).lean<TempoDoc[]>(),
    Car.find({ ...filter, "priceHistory.1": { $exists: true }, status: { $in: ["active", "removed"] } })
      .select(FIELDS)
      .sort({ createdAt: -1 })
      .limit(800)
      .lean<TempoDoc[]>(),
  ]);
  return summarizeTempo(removed, withHistory, label);
}

/**
 * İlan için piyasa temposu: önce aynı model ailesi ±2 yıl, yetmezse model ailesi, yetmezse marka (aynı araç tipi).
 * 6 saat önbellekte tutulur (arşiv yavaş değişir).
 */
export async function getMarketTempo(car: { brand: string; model: string; year: number; vehicleClass?: string }): Promise<MarketTempo | null> {
  const family = modelFamily(car.model, car.brand) || car.model;
  const key = `tempo:${car.brand}:${family}:${car.year}`.toLocaleLowerCase("tr-TR");
  return cached(key, 6 * 60 * 60 * 1000, async () => {
    const brand = { $in: brandStorageAliases(car.brand).map((b) => new RegExp(`^${turkishSearchRegex(b)}$`, "i")) };
    const model = modelFamilyRegex(car.model, car.brand);
    const tiers: Array<{ filter: Record<string, unknown>; label: string }> = [
      { filter: { brand, model, year: { $gte: car.year - 2, $lte: car.year + 2 } }, label: `${car.brand} ${family} ${car.year - 2}-${car.year + 2}` },
      { filter: { brand, model }, label: `${car.brand} ${family}` },
      { filter: { brand, ...(car.vehicleClass ? { vehicleClass: car.vehicleClass } : {}) }, label: `${car.brand} geneli` },
    ];
    let best: MarketTempo | null = null;
    for (const tier of tiers) {
      const tempo = await tempoFor(tier.filter, tier.label);
      if (tempo.days || tempo.drop) best = best ?? tempo;
      if (tempo.days && tempo.drop) return tempo;
    }
    return best;
  });
}
