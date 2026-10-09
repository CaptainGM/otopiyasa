import { ManualScrapeState } from "@/models/ManualScrapeState";

/** Bu süreden eski işaret "çalışmıyor" sayılır (süreç ölmüş olabilir). */
export const MANUAL_BEAT_STALE_MS = 90 * 1000;
const BEAT_EVERY_MS = 30 * 1000;

export function isManualScrapeRunning(state: { running?: boolean; heartbeatAt?: Date | null } | null | undefined, now = Date.now()): boolean {
  if (!state?.running || !state.heartbeatAt) return false;
  return now - new Date(state.heartbeatAt).getTime() < MANUAL_BEAT_STALE_MS;
}

/**
 * Elle tarama başlarken çağrılır; dönen fonksiyon bitince çağrılmalıdır. İş sürerken işaret 30 sn'de bir yenilenir, süreç beklenmedik
 * ölürse işaret kendiliğinden bayatlar. Yazma hataları taramayı etkilemez.
 */
export async function startManualBeat(label: string, actor: string): Promise<() => Promise<void>> {
  const now = () => new Date();
  const touch = () =>
    ManualScrapeState.updateOne({ key: "manual" }, { $set: { heartbeatAt: now(), running: true } }).catch(() => {});
  await ManualScrapeState.updateOne(
    { key: "manual" },
    { $set: { running: true, label, actor, startedAt: now(), heartbeatAt: now(), finishedAt: null } },
    { upsert: true }
  ).catch(() => {});
  const timer = setInterval(touch, BEAT_EVERY_MS);
  return async () => {
    clearInterval(timer);
    await ManualScrapeState.updateOne({ key: "manual" }, { $set: { running: false, finishedAt: now() } }).catch(() => {});
  };
}
