import { modelFamilyRegex } from "@/lib/model-family";

/**
 * EMSAL KURALI (tek yer). Bir ilanın "benzer" ya da "emsal" sayılması için aynı marka, aynı model ailesi ve yakın yıl ile kilometre
 * gerekir. Benzer ilan kartları ve fiyat tahmininin emsalleri bu kuralı kullanır; böylece aynı araç için farklı yerlerde farklı emsal
 * listesi çıkmaz. Fiyat yakınlığı emsal seçmez: 2025 model bir aracın emsali 2001 model değildir, ortalamaya da girmez.
 */

/** En fazla bu kadar yıl farklı bir araç emsal sayılır. */
export const MAX_COMPARABLE_YEAR_GAP = 3;
/** Yakın emsal sayısı bu kadar olunca pencere ±2 yılda kalır; az ilan varsa ±3'e genişler. */
export const PREFERRED_COMPARABLE_YEAR_GAP = 2;
const MIN_PREFERRED_COUNT = 4;

/** Kilometre penceresi: en az 30 bin km, aracın kendi kilometresinin yarısı kadar (yüksek km'li araçta daha geniş). */
export function mileageWindow(mileage: number): number {
  return Math.max(30_000, Math.round(mileage * 0.5));
}

export interface ComparableSubject {
  brand: string;
  model: string;
  year?: number;
  mileage?: number;
  vehicleClass?: string;
}

/** Marka, model ailesi ve araç sınıfı: model adının yazımı ("SCALA", "Scala 1.0 TSI") ve ilan tipi farklı olsa da aynı aile eşleşir. */
export function familyQuery(subject: ComparableSubject): Record<string, unknown> {
  const query: Record<string, unknown> = {
    brand: subject.brand,
    model: modelFamilyRegex(subject.model, subject.brand),
  };
  if (subject.vehicleClass) {
    query.vehicleClass = subject.vehicleClass === "otomobil" ? { $in: ["otomobil", null] } : subject.vehicleClass;
  }
  return query;
}

/** Benzer ilan sorgusu: aile + yıl penceresi (en fazla ±3) + kilometre penceresi. Yıl ya da kilometre bilinmiyorsa o pencere uygulanmaz. */
export function similarQuery(subject: ComparableSubject): Record<string, unknown> {
  const query = familyQuery(subject);
  if (subject.year) {
    query.year = { $gte: subject.year - MAX_COMPARABLE_YEAR_GAP, $lte: subject.year + MAX_COMPARABLE_YEAR_GAP };
  }
  if (subject.mileage && subject.mileage > 0) {
    const window = mileageWindow(subject.mileage);
    query.mileage = { $gte: Math.max(0, subject.mileage - window), $lte: subject.mileage + window };
  }
  return query;
}

export interface ComparableCandidate {
  year: number;
  mileage?: number;
}

/**
 * Adayları yıl farkına, sonra kilometre farkına göre sıralar. Yıl penceresi aşılan aday hiç alınmaz. Yakın yıllarda (±2) yeterli
 * aday varsa ±3 yıllık adaylar hiç gösterilmez; yoksa ±3'e kadar genişler.
 */
export function rankSimilar<T extends ComparableCandidate>(
  candidates: T[],
  subject: { year?: number; mileage?: number },
  limit: number
): T[] {
  const ranked = candidates
    .map((candidate) => {
      const gap = subject.year ? Math.abs(candidate.year - subject.year) : 0;
      const km =
        subject.mileage && subject.mileage > 0
          ? candidate.mileage == null
            ? 1
            : Math.abs(candidate.mileage - subject.mileage) / mileageWindow(subject.mileage)
          : 0;
      return { candidate, gap, km };
    })
    .filter((row) => row.gap <= MAX_COMPARABLE_YEAR_GAP);

  const nearCount = ranked.filter((row) => row.gap <= PREFERRED_COMPARABLE_YEAR_GAP).length;
  const allowedGap = nearCount >= MIN_PREFERRED_COUNT ? PREFERRED_COMPARABLE_YEAR_GAP : MAX_COMPARABLE_YEAR_GAP;

  return ranked
    .filter((row) => row.gap <= allowedGap)
    .sort((a, b) => a.gap - b.gap || a.km - b.km)
    .slice(0, limit)
    .map((row) => row.candidate);
}
