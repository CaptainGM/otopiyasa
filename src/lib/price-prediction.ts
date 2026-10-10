import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { normalizeTransmission } from "@/lib/vehicle-attrs";
import { normalizeFuelType } from "@/lib/normalize-fuel";
import { turkishSearchRegex, levenshtein, extractVehicleTokens, calculateTitleMatchScore } from "@/lib/utils";

export type Condition = "clean" | "painted" | "damaged";

/**
 * Toplu hesaplama belleği: market-snapshot her ilanın adil değerini aynı predictPrice ile hesaplar (kartlar, ilan
 * sayfası ve fırsatlar tek sayıyı göstersin diye). Aynı marka/model için eğitim ve emsal sorguları ilan başına
 * tekrar atılmasın diye withPredictionMemo içinde sonuçlar geçici olarak paylaşılır. Dizler salt okunur kullanılır.
 */
let queryMemo: Map<string, Promise<unknown>> | null = null;

function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!queryMemo) return fn();
  const hit = queryMemo.get(key);
  if (hit) return hit as Promise<T>;
  const pending = fn();
  queryMemo.set(key, pending);
  return pending;
}

export async function withPredictionMemo<T>(fn: () => Promise<T>): Promise<T> {
  queryMemo = new Map();
  try {
    return await fn();
  } finally {
    queryMemo = null;
  }
}

export interface ComparableCar {
  _id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
}

export interface PricePrediction {
  predictedPrice: number;
  
  method: "segment" | "brand+model" | "brand" | "global" | "average";
  sampleSize: number;
  /** Daha geniş regresyon havuzu (marka/genel); emsal sayısı değildir. */
  trainingSampleSize?: number;
  r2: number | null;
 
  outliersRemoved?: number;
  
  segmentSize?: number;
  /** Tahmini besleyen arşiv ilanı sayısı (düşük ağırlıkla; emsal sayısına girmez). */
  archivedUsed?: number;
 
  comparableRange?: { min: number; max: number };
  
  comparables: ComparableCar[];
  
  matchedModel?: string;
  
  lowerBound?: number;
 
  upperBound?: number;
  
  annualDepreciationPct?: number;
  
  coeffs?: number[];
 
  medians?: FeatureMedians;
  
  logStd?: number;
}

export interface TrainingRow {
  year: number;
  mileage: number;
  price: number;
  damaged: number;
  painted: number;
  
  engineSize: number | null;
 
  horsepower: number | null;
  /** 1/0; vites ya da yakıt kaynakta bilinmiyorsa null (segmentin bilinen oranıyla doldurulur). */
  automatic: number | null;
  diesel: number | null;
  /** Eğitimdeki payı: aktif ilan 1; arşivdeki (satılmış/kaldırılmış) ilan yaşına göre 0–0,5. Yoksa 1. */
  weight?: number;
  /** Arşivden gelen satır: emsal sayısına ve kullanıcıya gösterilen sayılara girmez. */
  archived?: boolean;
}


function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const A = matrix.map((row) => [...row]);
  const b = [...vector];

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivotRow][col])) pivotRow = row;
    }
    if (Math.abs(A[pivotRow][col]) < 1e-9) return null; 
    [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
    [b[col], b[pivotRow]] = [b[pivotRow], b[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < n; k++) A[row][k] -= factor * A[col][k];
      b[row] -= factor * b[col];
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) sum -= A[row][k] * x[k];
    x[row] = sum / A[row][row];
  }
  return x;
}


export function fitLinear(
  X: number[][],
  y: number[],
  ridge = 0,
  /** Satır ağırlıkları (yoksa hepsi 1). Arşiv ilanları aktiflerden daha az etki etsin diye kullanılır. */
  weights?: number[]
): { coeffs: number[]; r2: number } | null {
  const n = y.length;
  if (n === 0) return null;
  const k = X[0].length;
  if (n < k) return null;

  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    const w = weights ? weights[i] : 1;
    for (let a = 0; a < k; a++) {
      Xty[a] += w * X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += w * X[i][a] * X[i][b];
    }
  }

  if (ridge > 0) {
    for (let a = 1; a < k; a++) XtX[a][a] += ridge;
  }

  const beta = solveLinearSystem(XtX, Xty);
  if (!beta) return null;

  let wSum = 0;
  let wy = 0;
  for (let i = 0; i < n; i++) {
    const w = weights ? weights[i] : 1;
    wSum += w;
    wy += w * y[i];
  }
  const mean = wSum > 0 ? wy / wSum : 0;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const w = weights ? weights[i] : 1;
    let pred = 0;
    for (let a = 0; a < k; a++) pred += beta[a] * X[i][a];
    ssRes += w * (y[i] - pred) ** 2;
    ssTot += w * (y[i] - mean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { coeffs: beta, r2 };
}


export function derivePainted(paintChange?: string): number {
  if (!paintChange) return 0;
  const s = paintChange.toLocaleLowerCase("tr-TR");
  // "Boya/değişen yok" boya kelimesini içeriyor ama temiz araçtır (kurumsal kaynakların yazımı).
  if (/orijinal|orjinal|boyasız|boyasiz|değişensiz|degisensiz|değişen\s+yok/.test(s)) return 0;
  return /boya|değişen|degisen|lokal/.test(s) ? 1 : 0;
}

const CURRENT_YEAR = new Date().getFullYear();


export function carAge(year: number): number {
  return Math.max(0, CURRENT_YEAR - year);
}

export interface FeatureInput {
  year: number;
  mileage: number;
  damaged: number;
  painted: number;
  engineSize?: number | null;
  horsepower?: number | null;
  automatic?: number | null;
  diesel?: number | null;
}


export interface FeatureMedians {
  engineSize: number;
  horsepower: number;
  /** Vitesi/yakıtı bilinen satırlarda otomatik ve dizel oranı (0-1). */
  automatic: number;
  diesel: number;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function featureMedians(rows: TrainingRow[]): FeatureMedians {
  return {
    engineSize: median(
      rows.map((r) => r.engineSize).filter((v): v is number => !!v && v > 0)
    ),
    horsepower: median(
      rows.map((r) => r.horsepower).filter((v): v is number => !!v && v > 0)
    ),
    automatic: knownShare(rows.map((r) => r.automatic)),
    diesel: knownShare(rows.map((r) => r.diesel)),
  };
}

/** Bilinen (null olmayan) 1/0 değerlerin ortalaması; hiç bilinen yoksa 0. */
function knownShare(values: Array<number | null | undefined>): number {
  const known = values.filter((v): v is number => v === 0 || v === 1);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
}


function toFeatures(r: FeatureInput, medians: FeatureMedians): number[] {
  const age = carAge(r.year);
  const engine = r.engineSize && r.engineSize > 0 ? r.engineSize : medians.engineSize;
  const hp = r.horsepower && r.horsepower > 0 ? r.horsepower : medians.horsepower;
  return [
    1,
    age,
    age * age,
    r.mileage / 1000,
    r.damaged,
    r.painted,
    engine,
    hp / 100,
    // Bilinmeyen vites/yakıt "manuel/benzinli" sayılmaz; segmentteki bilinen oranla doldurulur.
    r.automatic ?? medians.automatic,
    r.diesel ?? medians.diesel,
  ];
}

interface TrainingDoc {
  year: number;
  mileage: number;
  price: number;
  damageFlag?: boolean;
  paintChange?: string;
  features?: {
    engineSize?: number;
    horsepower?: number;
    transmission?: string;
    fuelType?: string;
  };
}

/**
 * Eğitim verisi: onay bekleyen ve reddedilen (denetimden geçmemiş) üye ilanları hiçbir zaman kullanılmaz.
 * Arşivdeki (satılmış/kaldırılmış) ilanlar yalnızca istatistik içindir ve kullanıcıya gösterilmez.
 */
const UNMODERATED_EXCLUDED = { moderationStatus: { $nin: ["pending", "rejected"] } } as const;

function gearIndicator(raw?: string): number | null {
  const gear = normalizeTransmission(raw);
  return gear === null ? null : gear === "Manuel" ? 0 : 1;
}

function dieselIndicator(raw?: string): number | null {
  const fuel = normalizeFuelType(raw);
  return fuel === "Bilinmiyor" ? null : fuel === "Dizel" ? 1 : 0;
}

/** Marka regex'i + durum filtresi varken planlayıcı updatedAt indeksini seçip nadir markada tüm koleksiyonu tarıyordu (2 sn); marka+model indeksi süzmeyi anahtarlarda yapar. */
const BRAND_INDEX_HINT = { status: 1, brand: 1, model: 1, year: 1 } as const;

async function loadTrainingRows(
  filter: Record<string, unknown>,
  limit: number
): Promise<TrainingRow[]> {
  const query = Car.find({ ...filter, ...UNMODERATED_EXCLUDED })
    .sort({ updatedAt: -1 })
    .select("year mileage price damageFlag paintChange features")
    .limit(limit);
  if (filter.status !== undefined && typeof filter.brand === "object" && filter.brand !== null) query.hint(BRAND_INDEX_HINT);
  const docs = await query.lean<TrainingDoc[]>();
  return docs
    .filter((d) => d.price > 0 && d.year > 1900 && d.mileage >= 0)
    .map((d) => ({
      year: d.year,
      mileage: d.mileage,
      price: d.price,
      damaged: d.damageFlag ? 1 : 0,
      painted: derivePainted(d.paintChange),
      engineSize: d.features?.engineSize ?? null,
      horsepower: d.features?.horsepower ?? null,
      automatic: gearIndicator(d.features?.transmission),
      diesel: dieselIndicator(d.features?.fuelType),
    }));
}


/**
 * ARŞİV İLANLARI (satılmış/kaldırılmış) tahmini besler, yaşlandıkça etkisi azalır. Kullanıcının takvimi: arşive girişten sonraki ilk 30
 * gün ağırlık 1,0; sonraki her 30 günde 0,1 azalır (2. ay 0,9 ... 6. ay 0,5); 180 günden eskisi hiç etkilemez (eski fiyatlar bugünün
 * piyasasını bozmasın; "6 ayda ahım şahım zam gelmez" varsayımı). Sıfır km araçlar arşivden alınmaz (liste fiyatı zamlarla değişir).
 * Arşiv satırları kullanıcıya emsal olarak gösterilmez ve emsal sayısına girmez.
 *
 * Dayanak (8 Eki 2026, 2.200 aktif ilanı tek tek gizleyip tahmin ettirerek, iki ayrı rastgele örnek): bu takvimle medyan hata %8,9 → %8,2
 * ve ±%10 içinde %54 → %58; 3–7 ilanlı modellerde ±%10 içinde %43 → %51, 8–29 ilanlı modellerde %55 → %60. Eski davranışta marka ve genel
 * katmanlar arşivi yaşa bakmadan tam ağırlıkla karıştırıyordu ve kazanç sağlamıyordu. (Veritabanındaki tüm arşiv şu an 90 günden genç;
 * 4–6. ay basamakları ilerideki veriyle devreye girer.)
 */
export const ARCHIVE_MAX_AGE_DAYS = 180;
export const ARCHIVE_MIN_KM = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_MONTH_DAYS = 30;
const ARCHIVE_MONTHLY_DROP = 0.1;

export function archiveWeight(ageDays: number, maxAgeDays = ARCHIVE_MAX_AGE_DAYS): number {
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays >= maxAgeDays) return 0;
  const months = Math.floor(ageDays / ARCHIVE_MONTH_DAYS);
  return Math.max(0, Math.round((1 - ARCHIVE_MONTHLY_DROP * months) * 100) / 100);
}

type ArchivedDoc = TrainingDoc & { removedAt?: Date; updatedAt?: Date };

async function loadArchivedRows(identity: Record<string, unknown>, limit: number, now = Date.now()): Promise<TrainingRow[]> {
  const since = new Date(now - ARCHIVE_MAX_AGE_DAYS * DAY_MS);
  const query = Car.find({
    ...identity,
    ...UNMODERATED_EXCLUDED,
    status: "removed",
    price: { $gt: 0 },
    mileage: { $gte: ARCHIVE_MIN_KM },
    // Arşive girme tarihi: removedAt (yeni kayıtlarda); eski kayıtlarda yoksa son güncelleme zamanı.
    $and: [{ $or: [{ removedAt: { $gte: since } }, { removedAt: { $exists: false }, updatedAt: { $gte: since } }] }],
  })
    .sort({ updatedAt: -1 })
    .select("year mileage price damageFlag paintChange features removedAt updatedAt")
    .limit(limit);
  // Marka filtresi varken planlayıcı updatedAt sıralama indeksini seçip nadir markada (3 kayıt) 28 bin arşiv kaydını tek tek
  // tarıyordu (2,4 sn); marka+model indeksi regex'i anahtarlar üzerinde süzer.
  if (identity.brand !== undefined) query.hint(BRAND_INDEX_HINT);
  const docs = await query.lean<ArchivedDoc[]>();
  const rows: TrainingRow[] = [];
  for (const d of docs) {
    if (!(d.price > 0) || !(d.year > 1900) || !(d.mileage >= ARCHIVE_MIN_KM)) continue;
    const when = (d.removedAt ?? d.updatedAt) as Date | undefined;
    const weight = archiveWeight(when ? (now - new Date(when).getTime()) / DAY_MS : Infinity);
    if (weight <= 0) continue;
    rows.push({
      year: d.year,
      mileage: d.mileage,
      price: d.price,
      damaged: d.damageFlag ? 1 : 0,
      painted: derivePainted(d.paintChange),
      engineSize: d.features?.engineSize ?? null,
      horsepower: d.features?.horsepower ?? null,
      automatic: gearIndicator(d.features?.transmission),
      diesel: dieselIndicator(d.features?.fuelType),
      weight,
      archived: true,
    });
  }
  return rows;
}

/** Bir katmanın eğitim satırları: önce aktif ilanlar (tam ağırlık), ardından yaşa göre azalan ağırlıkla arşiv ilanları. */
async function loadTier(
  identity: Record<string, unknown>,
  activeLimit: number,
  archiveLimit: number,
  /** Aktif ilan sayısı bunu geçtiyse arşiv sorgulanmaz: geriye dönük testte (2.200 ilan) çok ilanlı modellerde kazanç <1 puandı. */
  skipArchiveAbove = Number.POSITIVE_INFINITY,
  /** Arşiv için daha dar bir eşleşme (başlık regex'i arşivde pahalı bir tarama olduğundan atlanır). */
  archiveIdentity: Record<string, unknown> = identity
): Promise<TrainingRow[]> {
  const active = await loadTrainingRows({ ...identity, status: "active" }, activeLimit);
  if (active.length >= skipArchiveAbove) return active;
  return [...active, ...(await loadArchivedRows(archiveIdentity, archiveLimit))];
}

/** Segmentte (marka + model) bu kadar aktif ilan varsa arşiv gerekmez. */
const SEGMENT_SKIP_ARCHIVE_ABOVE = 60;

/** Ağırlıkların toplamı: arşiv satırları aktiften az saydığı için örneklem büyüklüğü ölçüsü olarak satır sayısından doğrudur. */
export function effectiveSampleSize(rows: TrainingRow[]): number {
  return rows.reduce((sum, r) => sum + (r.weight ?? 1), 0);
}

async function loadComparables(
  brand: string,
  model: string,
  year: number,
  mileage: number,
  limit = 5,
  title?: string,
  vehicleClass?: string
): Promise<ComparableCar[]> {
  const classFilter = vehicleClass ? { vehicleClass: vehicleClass === "otomobil" ? { $in: ["otomobil", null] } : vehicleClass } : {};
  const docs = await memo(`cmp:${brand}|${model}|${vehicleClass || "all"}`, () => fetchComparableDocs(brand, model, classFilter));
  if (docs.length === 0) return [];
  return rankComparables(docs, brand, model, year, mileage, limit, title);
}

type ComparableDoc = { _id: { toString(): string }; title: string; brand: string; model: string; year: number; mileage: number; price: number };

async function fetchComparableDocs(brand: string, model: string, classFilter: Record<string, unknown> = {}): Promise<ComparableDoc[]> {
  // 1. Önce indeksli doğrudan eşleşme (5ms - Atlas M0 dostu)
  // Kullanıcıya gösterilen benzer ilanlar: yalnızca herkese açık (aktif + onaylı) olanlar.
  let docs = await Car.find({
    brand,
    model,
    ...classFilter,
    ...PUBLIC_LISTING_FILTER,
  })
    .sort({ createdAt: -1 })
    .select("title brand model year mileage price")
    .limit(100)
    .lean<{ _id: { toString(): string }; title: string; brand: string; model: string; year: number; mileage: number; price: number }[]>();

  // Yeterli emsal bulunamazsa regex ile genişlet
  if (docs.length < 5) {
    docs = await Car.find({
      brand: { $regex: turkishSearchRegex(brand), $options: "i" },
      ...classFilter,
      ...PUBLIC_LISTING_FILTER,
      $or: [
        { model: { $regex: turkishSearchRegex(model), $options: "i" } },
        { title: { $regex: turkishSearchRegex(model), $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .select("title brand model year mileage price")
      .limit(100)
      .lean<{ _id: { toString(): string }; title: string; brand: string; model: string; year: number; mileage: number; price: number }[]>();
  }

  return docs;
}

function rankComparables(
  docs: ComparableDoc[],
  brand: string,
  model: string,
  year: number,
  mileage: number,
  limit: number,
  title?: string
): ComparableCar[] {
  // %100 Jenerik alt-model, paket ve donanım ayrıştırması (tüm marka/modeller için evrensel)
  const targetTokens = extractVehicleTokens(title || "", brand, model);

  const scored = docs.map((d) => {
    const matchScore = calculateTitleMatchScore(targetTokens, d.title || "");
    // Eşleşen her özgün alt-model/paket belirteci (örn: "320i", "110", "comfortline", "amg") mesafeyi kısaltır
    const tokenBonus = matchScore * 50000;

    const yearDiff = Math.abs(d.year - year);
    const yearPenalty = yearDiff * 30000;
    const kmPenalty = Math.abs(d.mileage - mileage) / 10;

    return {
      _id: d._id.toString(),
      title: d.title,
      brand: d.brand,
      model: d.model,
      year: d.year,
      mileage: d.mileage,
      price: d.price,
      _dist: yearPenalty + kmPenalty - tokenBonus,
    };
  }).sort((a, b) => a._dist - b._dist);

  // En yakın adaylar içindeki aşırı uç fiyatları (örn: 36.5M) yerel olarak ele
  const topSlice = scored.slice(0, Math.min(12, scored.length));
  const slicePrices = topSlice.map((c) => c.price).filter((p) => p > 0);
  const med = median(slicePrices);
  const inliers = med > 0
    ? topSlice.filter((c) => c.price >= med * 0.4 && c.price <= med * 2.2)
    : topSlice;

  const result = inliers.length >= 2 ? inliers : topSlice;
  return result.slice(0, limit).map(({ _dist, ...rest }) => rest);
}

const MIN_SAMPLE_FOR_REGRESSION = 8;

function conditionFlags(condition: Condition): { damaged: number; painted: number } {
  if (condition === "damaged") return { damaged: 1, painted: 1 };
  if (condition === "painted") return { damaged: 0, painted: 1 };
  return { damaged: 0, painted: 0 };
}


export function annualDepreciation(rows: TrainingRow[]): number | null {
  if (rows.length < MIN_SAMPLE_FOR_REGRESSION) return null;
  const X = rows.map((r) => [1, carAge(r.year)]);
  const y = rows.map((r) => Math.log(r.price));
  const fit = fitLinear(X, y, 1e-6);
  if (!fit) return null;
  const pct = (1 - Math.exp(fit.coeffs[1])) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.round(pct * 10) / 10;
}

const norm = (s: string) => s.toLocaleLowerCase("tr-TR").trim();



export async function resolveModel(brand: string, model: string, vehicleClass?: string): Promise<string> {
  return memo(`resolve:${brand}|${model}|${vehicleClass || "all"}`, () => resolveModelUncached(brand, model, vehicleClass));
}

async function resolveModelUncached(brand: string, model: string, vehicleClass?: string): Promise<string> {
  const input = model.trim();
  if (!input) return model;
  const classFilter = vehicleClass ? { vehicleClass: vehicleClass === "otomobil" ? { $in: ["otomobil", null] } : vehicleClass } : {};

  // İndeksli kontrol: Marka ve model zaten DB'de tam eşleşiyorsa distinct taramasına hiç girme (2ms)
  const exists = await Car.exists({
    brand: { $regex: `^${turkishSearchRegex(brand)}$`, $options: "i" },
    model: { $regex: `^${turkishSearchRegex(input)}$`, $options: "i" },
    ...classFilter,
  });
  if (exists) return input;

  const models = (await Car.distinct("model", {
    brand: { $regex: turkishSearchRegex(brand), $options: "i" },
    ...classFilter,
  })) as string[];
  if (models.length === 0) return input;

  const target = norm(input);
  if (models.some((m) => norm(m) === target)) return input;

  let best: string | null = null;
  let bestDist = Infinity;
  for (const m of models) {
    const d = levenshtein(target, norm(m));
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }

  const threshold = Math.max(2, Math.floor(target.length * 0.34));
  return best && bestDist <= threshold ? best : input;
}

export async function predictPrice(
  brand: string,
  model: string,
  year: number,
  mileage: number,
  condition: Condition = "clean",
  title?: string,
  /** Model adı veritabanından geliyorsa (toplu adil değer hesabı) yazım düzeltme sorgusu atlanır. */
  options: { modelFromDb?: boolean; vehicleClass?: string } = {}
): Promise<PricePrediction> {
  const resolvedModel = options.modelFromDb ? model : await resolveModel(brand, model, options.vehicleClass);
  const matchedModel = norm(resolvedModel) !== norm(model) ? resolvedModel : undefined;
  const vehicleClassFilter = options.vehicleClass
    ? { vehicleClass: options.vehicleClass === "otomobil" ? { $in: ["otomobil", null] } : options.vehicleClass }
    : {};

  const { damaged, painted } = conditionFlags(condition);
  const input: FeatureInput = { year, mileage, damaged, painted };

  // 1. Önce doğrudan indeksli segment sorgusu (~5ms): aktif ilanlar + yaşa göre ağırlıklı arşiv.
  let segmentRows = await memo(`seg:${brand}|${resolvedModel}|${options.vehicleClass || "all"}`, () => loadTier({ brand, model: resolvedModel, ...vehicleClassFilter }, 200, 100, SEGMENT_SKIP_ARCHIVE_ABOVE));
  const activeSegmentCount = await memo(`segcount:${brand}|${resolvedModel}|${year}|${options.vehicleClass || "all"}`, () =>
    Car.countDocuments({ brand, model: resolvedModel, year, ...PUBLIC_LISTING_FILTER, ...vehicleClassFilter })
  );

  // Yeterli örnek yoksa geniş regex sorgusuyla destekle
  if (effectiveSampleSize(segmentRows) < MIN_SAMPLE_FOR_REGRESSION) {
    segmentRows = await memo(`segrx:${brand}|${resolvedModel}|${options.vehicleClass || "all"}`, () =>
      loadTier(
        {
          brand: { $regex: turkishSearchRegex(brand), $options: "i" },
          ...vehicleClassFilter,
          $or: [
            { model: { $regex: turkishSearchRegex(resolvedModel), $options: "i" } },
            { title: { $regex: turkishSearchRegex(resolvedModel), $options: "i" } },
          ],
        },
        200,
        100,
        SEGMENT_SKIP_ARCHIVE_ABOVE,
        { brand: { $regex: turkishSearchRegex(brand), $options: "i" }, model: { $regex: turkishSearchRegex(resolvedModel), $options: "i" }, ...vehicleClassFilter }
      )
    );
  }

  const comparables = await loadComparables(brand, resolvedModel, year, mileage, 5, title, options.vehicleClass);
  const finalPrediction = await predictFromTiers(
    {
      segment: segmentRows,
      brand: () => memo(`brand:${brand}|${options.vehicleClass || "all"}`, () => loadTier({ brand: { $regex: turkishSearchRegex(brand), $options: "i" }, ...vehicleClassFilter }, 500, 250)),
      global: () => memo(`global:${options.vehicleClass || "all"}`, () => loadTier(vehicleClassFilter, 1000, 300)),
    },
    input,
    comparables,
    matchedModel,
    activeSegmentCount
  );

  return anchorToClosePeers(finalPrediction, comparables, year, mileage, condition);
}

export interface PredictionTiers {
  /** Marka + model satırları (aktif + ağırlıklı arşiv). */
  segment: TrainingRow[];
  /** Marka geneli; yalnızca segment yetmezse çağrılır. */
  brand: () => Promise<TrainingRow[]>;
  /** Tüm piyasa; yalnızca marka da yetmezse çağrılır. */
  global: () => Promise<TrainingRow[]>;
}

/**
 * Katmanlı tahmin (segment → marka → genel), veritabanından bağımsız: yükleme dışarıdadır. Aynı fonksiyonu geriye dönük test de
 * (bellekteki satırlarla) kullanır, böylece ölçülen doğruluk canlı sistemin doğruluğudur.
 */
export async function predictFromTiers(
  tiers: PredictionTiers,
  input: FeatureInput,
  comparables: ComparableCar[],
  matchedModel?: string,
  activeSegmentCount?: number
): Promise<PricePrediction> {
  const segmentRows = tiers.segment;
  const activeSegment = segmentRows.filter((r) => !r.archived);
  const comparableSegmentSize = activeSegmentCount ?? activeSegment.length;
  const comparableRange =
    comparables.length > 0
      ? {
          min: Math.min(...comparables.map((c) => c.price)),
          max: Math.max(...comparables.map((c) => c.price)),
        }
      : undefined;

  // Gösterilen sayılar (emsal sayısı, yıllık değer kaybı) yalnızca aktif ilanlardan gelir.
  const annualDepreciationPct = annualDepreciation(activeSegment) ?? undefined;
  const extra = {
    matchedModel,
    annualDepreciationPct,
    segmentSize: comparableSegmentSize,
    comparableRange,
  };

  const withSegmentSpecs = (rows: TrainingRow[]): FeatureInput => {
    const m = featureMedians(rows);
    return {
      ...input,
      engineSize: m.engineSize,
      horsepower: m.horsepower,
      automatic: m.automatic >= 0.5 ? 1 : 0,
      diesel: m.diesel >= 0.5 ? 1 : 0,
    };
  };

  // sampleSize kullanıcıya gösterilen aynı marka/model/yıl emsal sayısıdır. Daha geniş marka/genel
  // regresyon havuzu yalnızca trainingSampleSize alanında tutulur.
  const publish = (prediction: PricePrediction): PricePrediction => ({
    ...prediction,
    ...extra,
    sampleSize: comparableSegmentSize,
    trainingSampleSize: prediction.sampleSize,
  });
  const attempt = tryPredict(segmentRows, withSegmentSpecs(segmentRows), "segment", comparables);
  if (attempt) return publish(attempt);

  const brandRows = await tiers.brand();
  const brandAttempt = tryPredict(
    brandRows,
    withSegmentSpecs(segmentRows.length > 0 ? segmentRows : brandRows),
    "brand",
    comparables
  );
  if (brandAttempt) return publish(applyModelOffset(brandAttempt, segmentRows));

  const globalRows = await tiers.global();
  const globalAttempt = tryPredict(
    globalRows,
    withSegmentSpecs(segmentRows.length > 0 ? segmentRows : globalRows),
    "global",
    comparables
  );
  if (globalAttempt) return publish(applyModelOffset(globalAttempt, segmentRows));

  const activeGlobal = globalRows.filter((r) => !r.archived);
  const pool = activeGlobal.length > 0 ? activeGlobal : globalRows;
  const fallbackAvg = pool.length > 0 ? pool.reduce((sum, r) => sum + r.price, 0) / pool.length : 0;
  return {
    predictedPrice: Math.round(fallbackAvg),
    method: "average",
    sampleSize: comparableSegmentSize,
    trainingSampleSize: pool.length,
    r2: null,
    comparables,
    ...extra,
  };
}

/**
 * Regresyon modelinin küçük örneklem veya uç yaş verilerinde (örn: 1990 model klasiklerin
 * 2025 model lüks SUV tahminini aşağı çekmesi veya aykırı verilerin kuadratik eğriyi saptırması)
 * saçmalamasını önleyen emsal çıpalama (peer anchoring & sanity check) mekanizması.
 */
function anchorToClosePeers(
  prediction: PricePrediction,
  comparables: ComparableCar[],
  year: number,
  mileage: number,
  condition: Condition
): PricePrediction {
  if (comparables.length < 2) return prediction;

  // Hedef yıla çok yakın (±1 yıl) emsalleri filtrele
  let closePeers = comparables.filter((c) => Math.abs(c.year - year) <= 1 && c.price > 0);
  if (closePeers.length < 2) {
    closePeers = comparables.filter((c) => Math.abs(c.year - year) <= 2 && c.price > 0);
  }
  if (closePeers.length < 2) return prediction;

  const peerPrices = closePeers.map((c) => c.price);
  const peerMedian = median(peerPrices);
  if (peerMedian <= 0) return prediction;

  const currentPred = prediction.predictedPrice;
  const ratio = currentPred / peerMedian;

  // Eğer regresyon tahmini yakın emsal medyanından %20'den fazla sapıyorsa
  // (örneğin regresyon 5.8M derken emsaller 13.5M ise), regresyon eğrisi sınırda kopmuş demektir.
  if (ratio < 0.80 || ratio > 1.25) {
    // Emsal medyanını baz al, km ve kondisyona göre hassas ayarla
    const peerMileages = closePeers.map((c) => c.mileage);
    const medMileage = median(peerMileages);
    const kmDiff = (mileage - medMileage) / 10000;
    const kmAdjustment = Math.max(-0.15, Math.min(0.15, -kmDiff * 0.012));

    let condAdjustment = 0;
    if (condition === "damaged") condAdjustment = -0.15;
    else if (condition === "painted") condAdjustment = -0.05;

    const adjusted = Math.round(peerMedian * (1 + kmAdjustment + condAdjustment));
    const factor = Math.exp(prediction.logStd ?? 0.12);

    return {
      ...prediction,
      predictedPrice: adjusted,
      lowerBound: Math.round(adjusted / factor),
      upperBound: Math.round(adjusted * factor),
    };
  }

  return prediction;
}


function applyModelOffset(
  prediction: PricePrediction,
  segmentRows: TrainingRow[]
): PricePrediction {
  if (segmentRows.length === 0 || !prediction.coeffs || !prediction.medians) {
    return prediction;
  }
  const offset = modelOffset(segmentRows, prediction.coeffs, prediction.medians);
  if (!Number.isFinite(offset) || offset === 0) return prediction;

  const shifted = prediction.predictedPrice * Math.exp(offset);
  const factor = Math.exp(prediction.logStd ?? 0);
  return {
    ...prediction,
    predictedPrice: Math.round(shifted),
    method: prediction.method === "brand" ? "brand+model" : prediction.method,
    lowerBound: Math.round(shifted / factor),
    upperBound: Math.round(shifted * factor),
  };
}


const RIDGE_LAMBDA = 1e-3;


const OUTLIER_SIGMA = 2.5;


function dropOutliers(
  rows: TrainingRow[],
  X: number[][],
  yLog: number[],
  coeffs: number[]
): { rows: TrainingRow[]; X: number[][]; yLog: number[]; removed: number } {
  const residuals = yLog.map((y, i) => {
    let pred = 0;
    for (let a = 0; a < X[i].length; a++) pred += coeffs[a] * X[i][a];
    return y - pred;
  });
  const std = Math.sqrt(
    residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, residuals.length)
  );
  if (!(std > 0)) return { rows, X, yLog, removed: 0 };

  const maxDrop = Math.floor(rows.length * 0.2);
  const keep = residuals
    .map((r, i) => ({ i, abs: Math.abs(r) }))
    .sort((a, b) => b.abs - a.abs)
    .slice(0, maxDrop)
    .filter((c) => c.abs > OUTLIER_SIGMA * std)
    .map((c) => c.i);
  const drop = new Set(keep);
  if (drop.size === 0 || rows.length - drop.size < MIN_SAMPLE_FOR_REGRESSION) {
    return { rows, X, yLog, removed: 0 };
  }

  const idx = rows.map((_, i) => i).filter((i) => !drop.has(i));
  return {
    rows: idx.map((i) => rows[i]),
    X: idx.map((i) => X[i]),
    yLog: idx.map((i) => yLog[i]),
    removed: drop.size,
  };
}

export function tryPredict(
  rows: TrainingRow[],
  input: FeatureInput,
  method: PricePrediction["method"],
  comparables: ComparableCar[]
): PricePrediction | null {
  if (rows.length < MIN_SAMPLE_FOR_REGRESSION || effectiveSampleSize(rows) < MIN_SAMPLE_FOR_REGRESSION) return null;

  const medians = featureMedians(rows);
  let X = rows.map((r) => toFeatures(r, medians));

  let yLog = rows.map((r) => Math.log(r.price));
  let trainRows = rows;
  let w = rows.map((r) => r.weight ?? 1);

  const firstFit = fitLinear(X, yLog, RIDGE_LAMBDA, w);
  if (!firstFit) return null;

  const cleaned = dropOutliers(trainRows, X, yLog, firstFit.coeffs);
  const outliersRemoved = cleaned.removed;
  let fit = firstFit;
  if (outliersRemoved > 0) {
    const cleanedW = cleaned.rows.map((r) => r.weight ?? 1);
    const refit = fitLinear(cleaned.X, cleaned.yLog, RIDGE_LAMBDA, cleanedW);
    if (refit) {
      fit = refit;
      trainRows = cleaned.rows;
      X = cleaned.X;
      yLog = cleaned.yLog;
      w = cleanedW;
    }
  }

  const point = toFeatures(input, medians);
  let predictedLog = 0;
  for (let a = 0; a < point.length; a++) predictedLog += fit.coeffs[a] * point[a];
  const predicted = Math.exp(predictedLog);
  if (!Number.isFinite(predicted) || predicted <= 0) return null;

  const prices = trainRows.map((r) => r.price);
  const wSum = w.reduce((s, v) => s + v, 0);
  const meanPrice = wSum > 0 ? prices.reduce((s, v, i) => s + w[i] * v, 0) / wSum : 0;
  let ssRes = 0;
  let ssTot = 0;
  let sumLogResSq = 0;
  for (let i = 0; i < trainRows.length; i++) {
    let pLog = 0;
    for (let a = 0; a < X[i].length; a++) pLog += fit.coeffs[a] * X[i][a];
    const pred = Math.exp(pLog);
    ssRes += w[i] * (prices[i] - pred) ** 2;
    ssTot += w[i] * (prices[i] - meanPrice) ** 2;
    sumLogResSq += w[i] * (yLog[i] - pLog) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const dof = Math.max(1, wSum - point.length);
  const logStd = Math.sqrt(sumLogResSq / dof);
  const factor = Math.exp(logStd);
  const archivedUsed = trainRows.filter((r) => r.archived).length;

  return {
    predictedPrice: Math.round(predicted),
    method,
    // Kullanıcıya gösterilen örneklem yalnızca aktif ilanlardır; arşiv ayrıca archivedUsed'da.
    sampleSize: trainRows.length - archivedUsed,
    ...(archivedUsed > 0 ? { archivedUsed } : {}),
    outliersRemoved,
    r2: Math.max(0, Math.min(1, r2)),
    comparables,
    lowerBound: Math.round(predicted / factor),
    upperBound: Math.round(predicted * factor),
    coeffs: fit.coeffs,
    medians,
    logStd,
  };
}


const POOLING_K = 3;

export function modelOffset(
  segmentRows: TrainingRow[],
  coeffs: number[],
  medians: FeatureMedians
): number {
  if (segmentRows.length === 0) return 0;
  let sum = 0;
  let wSum = 0;
  for (const row of segmentRows) {
    const w = row.weight ?? 1;
    const x = toFeatures(row, medians);
    let pred = 0;
    for (let a = 0; a < x.length; a++) pred += coeffs[a] * x[a];
    sum += w * (Math.log(row.price) - pred);
    wSum += w;
  }
  if (wSum <= 0) return 0;
  const meanResidual = sum / wSum;
  const shrink = wSum / (wSum + POOLING_K);
  return meanResidual * shrink;
}
