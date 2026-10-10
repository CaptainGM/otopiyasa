/** Reject parser glitches that turn a valid listing price into a tiny or enormous value. */
export function isPlausibleScrapedPrice(current: number | undefined, next: number): boolean {
  if (!Number.isFinite(next) || next <= 0) return false;
  if (!current || !Number.isFinite(current) || current <= 0) return true;
  return next >= current * 0.2 && next <= current * 5;
}
