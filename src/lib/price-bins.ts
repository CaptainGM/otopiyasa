

export interface PriceBin {
  label: string;
  count: number;
  isCurrent: boolean;
  
  min: number;
  max: number;
}

function shortPrice(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mn`;
  }
  return `${Math.round(value / 1_000)} bin`;
}

export function buildPriceBins(
  prices: number[],
  highlightPrice: number,
  binCount = 7
): PriceBin[] {
  const valid = prices.filter((price) => price > 0);
  if (valid.length < 3) return [];

  const min = Math.min(...valid, highlightPrice);
  const max = Math.max(...valid, highlightPrice);
  if (min === max) return [];

  const width = (max - min) / binCount;
  const bins: PriceBin[] = Array.from({ length: binCount }, (_, index) => {
    const start = min + index * width;
    const end = start + width;
    return {
      label: `${shortPrice(start)} – ${shortPrice(end)} ₺`,
      count: 0,
      isCurrent: false,
      min: Math.round(start),
      max: Math.round(end),
    };
  });

  const binIndex = (price: number) =>
    Math.min(Math.floor((price - min) / width), binCount - 1);

  for (const price of valid) {
    bins[binIndex(price)].count += 1;
  }
  bins[binIndex(highlightPrice)].isCurrent = true;

  return bins;
}
