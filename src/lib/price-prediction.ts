import { Car } from "@/models/Car";
import { turkishSearchRegex, levenshtein } from "@/lib/utils";

export type Condition = "clean" | "painted" | "damaged";

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
  r2: number | null;
 
  outliersRemoved?: number;
  
  segmentSize?: number;
 
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

interface TrainingRow {
  year: number;
  mileage: number;
  price: number;
  damaged: number;
  painted: number;
  
  engineSize: number | null;
 
  horsepower: number | null;
  automatic: number; 
  diesel: number; 
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
  ridge = 0
): { coeffs: number[]; r2: number } | null {
  const n = y.length;
  if (n === 0) return null;
  const k = X[0].length;
  if (n < k) return null;

  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }

  
  if (ridge > 0) {
    for (let a = 1; a < k; a++) XtX[a][a] += ridge;
  }

  const beta = solveLinearSystem(XtX, Xty);
  if (!beta) return null;

  const mean = y.reduce((s, v) => s + v, 0) / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let a = 0; a < k; a++) pred += beta[a] * X[i][a];
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - mean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { coeffs: beta, r2 };
}


export function derivePainted(paintChange?: string): number {
  if (!paintChange) return 0;
  const s = paintChange.toLocaleLowerCase("tr-TR");
  if (/orijinal|boyasız|boyasiz|değişensiz|degisensiz/.test(s)) return 0;
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
  automatic?: number;
  diesel?: number;
}


export interface FeatureMedians {
  engineSize: number;
  horsepower: number;
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
  };
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
    r.automatic ?? 0,
    r.diesel ?? 0,
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

async function loadTrainingRows(
  filter: Record<string, unknown>,
  limit: number
): Promise<TrainingRow[]> {
  const docs = await Car.find(filter)
    .select("year mileage price damageFlag paintChange features")
    .limit(limit)
    .lean<TrainingDoc[]>();
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
      automatic: /otomatik|yarı otomatik|tiptronic/i.test(d.features?.transmission || "") ? 1 : 0,
      diesel: /dizel/i.test(d.features?.fuelType || "") ? 1 : 0,
    }));
}


async function loadComparables(
  brand: string,
  model: string,
  year: number,
  mileage: number,
  limit = 5
): Promise<ComparableCar[]> {
  const docs = await Car.find({
    brand: { $regex: turkishSearchRegex(brand), $options: "i" },
    $or: [
      { model: { $regex: turkishSearchRegex(model), $options: "i" } },
      { title: { $regex: turkishSearchRegex(model), $options: "i" } },
    ],
  })
    .select("title brand model year mileage price")
    .limit(200)
    .lean<{ _id: { toString(): string }; title: string; brand: string; model: string; year: number; mileage: number; price: number }[]>();

  return docs
    .map((d) => ({
      _id: d._id.toString(),
      title: d.title,
      brand: d.brand,
      model: d.model,
      year: d.year,
      mileage: d.mileage,
      price: d.price,
      
      _dist: Math.abs(d.year - year) * 20000 + Math.abs(d.mileage - mileage) / 10,
    }))
    .sort((a, b) => a._dist - b._dist)
    .slice(0, limit)
    .map(({ _dist, ...rest }) => rest);
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



export async function resolveModel(brand: string, model: string): Promise<string> {
  const input = model.trim();
  if (!input) return model;

  const models = (await Car.distinct("model", {
    brand: { $regex: turkishSearchRegex(brand), $options: "i" },
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
  condition: Condition = "clean"
): Promise<PricePrediction> {
  
  const resolvedModel = await resolveModel(brand, model);
  const matchedModel = norm(resolvedModel) !== norm(model) ? resolvedModel : undefined;

  const { damaged, painted } = conditionFlags(condition);
  const input: FeatureInput = { year, mileage, damaged, painted };

  const segmentRows = await loadTrainingRows(
    {
      brand: { $regex: turkishSearchRegex(brand), $options: "i" },
      $or: [
        { model: { $regex: turkishSearchRegex(resolvedModel), $options: "i" } },
        { title: { $regex: turkishSearchRegex(resolvedModel), $options: "i" } },
      ],
    },
    300
  );
  const comparables = await loadComparables(brand, resolvedModel, year, mileage);
  const comparableRange =
    comparables.length > 0
      ? {
          min: Math.min(...comparables.map((c) => c.price)),
          max: Math.max(...comparables.map((c) => c.price)),
        }
      : undefined;
  
  const annualDepreciationPct = annualDepreciation(segmentRows) ?? undefined;
  const extra = {
    matchedModel,
    annualDepreciationPct,
    segmentSize: segmentRows.length,
    comparableRange,
  };


  const withSegmentSpecs = (rows: TrainingRow[]): FeatureInput => {
    const m = featureMedians(rows);
    const auto = rows.filter((r) => r.automatic).length / Math.max(1, rows.length);
    const dsl = rows.filter((r) => r.diesel).length / Math.max(1, rows.length);
    return {
      ...input,
      engineSize: m.engineSize,
      horsepower: m.horsepower,
      automatic: auto >= 0.5 ? 1 : 0,
      diesel: dsl >= 0.5 ? 1 : 0,
    };
  };

  const attempt = tryPredict(
    segmentRows,
    withSegmentSpecs(segmentRows),
    "segment",
    comparables
  );
  if (attempt) return { ...attempt, ...extra };

  const brandRows = await loadTrainingRows(
    { brand: { $regex: turkishSearchRegex(brand), $options: "i" } },
    500
  );
  const brandAttempt = tryPredict(
    brandRows,
   
    withSegmentSpecs(segmentRows.length > 0 ? segmentRows : brandRows),
    "brand",
    comparables
  );
  if (brandAttempt) {
    return { ...applyModelOffset(brandAttempt, segmentRows), ...extra };
  }

  const globalRows = await loadTrainingRows({}, 1000);
  const globalAttempt = tryPredict(
    globalRows,
    withSegmentSpecs(segmentRows.length > 0 ? segmentRows : globalRows),
    "global",
    comparables
  );
  if (globalAttempt) {
    return { ...applyModelOffset(globalAttempt, segmentRows), ...extra };
  }

  const fallbackAvg =
    globalRows.length > 0
      ? globalRows.reduce((sum, r) => sum + r.price, 0) / globalRows.length
      : 0;
  return {
    predictedPrice: Math.round(fallbackAvg),
    method: "average",
    sampleSize: globalRows.length,
    r2: null,
    comparables,
    ...extra,
  };
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
  if (rows.length < MIN_SAMPLE_FOR_REGRESSION) return null;

  const medians = featureMedians(rows);
  let X = rows.map((r) => toFeatures(r, medians));

  let yLog = rows.map((r) => Math.log(r.price));
  let trainRows = rows;

  const firstFit = fitLinear(X, yLog, RIDGE_LAMBDA);
  if (!firstFit) return null;


  const cleaned = dropOutliers(trainRows, X, yLog, firstFit.coeffs);
  const outliersRemoved = cleaned.removed;
  let fit = firstFit;
  if (outliersRemoved > 0) {
    const refit = fitLinear(cleaned.X, cleaned.yLog, RIDGE_LAMBDA);
    if (refit) {
      fit = refit;
      trainRows = cleaned.rows;
      X = cleaned.X;
      yLog = cleaned.yLog;
    }
  }

  const point = toFeatures(input, medians);
  let predictedLog = 0;
  for (let a = 0; a < point.length; a++) predictedLog += fit.coeffs[a] * point[a];
  const predicted = Math.exp(predictedLog);
  if (!Number.isFinite(predicted) || predicted <= 0) return null;


  const prices = trainRows.map((r) => r.price);
  const meanPrice = prices.reduce((s, v) => s + v, 0) / prices.length;
  let ssRes = 0;
  let ssTot = 0;
  let sumLogResSq = 0; 
  for (let i = 0; i < trainRows.length; i++) {
    let pLog = 0;
    for (let a = 0; a < X[i].length; a++) pLog += fit.coeffs[a] * X[i][a];
    const pred = Math.exp(pLog);
    ssRes += (prices[i] - pred) ** 2;
    ssTot += (prices[i] - meanPrice) ** 2;
    sumLogResSq += (yLog[i] - pLog) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;


  const dof = Math.max(1, trainRows.length - point.length);
  const logStd = Math.sqrt(sumLogResSq / dof);
  const factor = Math.exp(logStd);

  return {
    predictedPrice: Math.round(predicted),
    method,
    sampleSize: trainRows.length,
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
  for (const row of segmentRows) {
    const x = toFeatures(row, medians);
    let pred = 0;
    for (let a = 0; a < x.length; a++) pred += coeffs[a] * x[a];
    sum += Math.log(row.price) - pred;
  }
  const meanResidual = sum / segmentRows.length;
  const shrink = segmentRows.length / (segmentRows.length + POOLING_K);
  return meanResidual * shrink;
}
