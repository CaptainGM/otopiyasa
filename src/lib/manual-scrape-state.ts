import { ManualScrapeState } from "@/models/ManualScrapeState";
import { randomUUID } from "node:crypto";

/** Bu süreden eski işaret "çalışmıyor" sayılır (süreç ölmüş olabilir). */
export const MANUAL_BEAT_STALE_MS = 90 * 1000;
const BEAT_EVERY_MS = 30 * 1000;

export class ManualScrapeAlreadyRunningError extends Error {
  constructor() {
    super("Başka bir manuel tarama zaten çalışıyor.");
    this.name = "ManualScrapeAlreadyRunningError";
  }
}

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
  const ownerToken = randomUUID();
  try {
    await ManualScrapeState.updateOne(
      { key: "manual" },
      { $setOnInsert: { running: false } },
      { upsert: true }
    );
  } catch (error) {
    // Two first requests may both attempt to create the singleton row.
    if ((error as { code?: number })?.code !== 11000) throw error;
  }

  const staleBefore = new Date(Date.now() - MANUAL_BEAT_STALE_MS);
  const claimed = await ManualScrapeState.findOneAndUpdate(
    {
      key: "manual",
      $or: [
        { running: { $ne: true } },
        { heartbeatAt: { $lte: staleBefore } },
        { heartbeatAt: null },
      ],
    },
    {
      $set: {
        running: true,
        label,
        actor,
        ownerToken,
        startedAt: now(),
        heartbeatAt: now(),
        finishedAt: null,
      },
    },
    { new: true }
  );
  if (!claimed) throw new ManualScrapeAlreadyRunningError();

  const touch = () =>
    ManualScrapeState.updateOne({ key: "manual", ownerToken }, { $set: { heartbeatAt: now(), running: true } }).catch(() => {});
  const timer = setInterval(touch, BEAT_EVERY_MS);
  return async () => {
    clearInterval(timer);
    await ManualScrapeState.updateOne(
      { key: "manual", ownerToken },
      { $set: { running: false, finishedAt: now() }, $unset: { ownerToken: 1 } }
    ).catch(() => {});
  };
}
