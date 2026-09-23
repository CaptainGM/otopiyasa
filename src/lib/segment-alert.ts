
export const MIN_SEGMENT_SAMPLES = 3;


export const SEGMENT_ALERT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; 

export function shouldNotifySegmentAlert(params: {
  currentAvgPrice: number | null;
  targetAvgPrice: number;
  sampleCount: number;
  lastNotifiedAt: Date | string | null;
  now?: Date;
}): boolean {
  const { currentAvgPrice, targetAvgPrice, sampleCount, lastNotifiedAt } = params;
  const now = params.now ?? new Date();

  if (currentAvgPrice === null || !Number.isFinite(currentAvgPrice)) return false;
  if (sampleCount < MIN_SEGMENT_SAMPLES) return false;
  if (currentAvgPrice > targetAvgPrice) return false;

  if (!lastNotifiedAt) return true;
  const last = new Date(lastNotifiedAt).getTime();
  return now.getTime() - last >= SEGMENT_ALERT_COOLDOWN_MS;
}
