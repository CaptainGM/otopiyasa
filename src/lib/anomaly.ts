

export interface PriceAnomaly {
  z: number;

  pctFromMean: number;
  label: "ucuz" | "pahali" | null;
  sampleCount: number;
}

export function detectPriceAnomaly(
  price: number,
  segmentPrices: number[],
  options: { minSamples?: number; threshold?: number } = {}
): PriceAnomaly | null {
  const minSamples = options.minSamples ?? 5;
  const threshold = options.threshold ?? 1.5;

  const valid = segmentPrices.filter((value) => value > 0);
  if (valid.length < minSamples || price <= 0) return null;

  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  const variance =
    valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / valid.length;
  const std = Math.sqrt(variance);
  if (std === 0) return null;

  const z = (price - mean) / std;
  const pctFromMean = Math.round(((price - mean) / mean) * 100);

  return {
    z: Math.round(z * 100) / 100,
    pctFromMean,
    label: z <= -threshold ? "ucuz" : z >= threshold ? "pahali" : null,
    sampleCount: valid.length,
  };
}
