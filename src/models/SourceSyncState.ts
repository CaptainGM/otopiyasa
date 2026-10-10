import mongoose, { Schema } from "mongoose";

/**
 * Kaynak başına "tam envanter senkronu" durumunu tutar. Daemon bir sonraki
 * senkronun ne zaman yapılacağına buradan karar verir; admin panelleri (web +
 * mobil) de her kaynağın en son ne zaman doğrulandığını buradan gösterir.
 *
 * Süreç belleği yerine veritabanında durur ki daemon yeniden başladığında
 * her şeyi baştan taramasın.
 */
export interface SourceSyncStateDoc {
  source: string;
  lastRunAt?: Date;
  lastSuccessAt?: Date;
  lastStatus?: "ok" | "incomplete" | "breaker" | "failed";
  lastMessage?: string;
  complete?: boolean;
  seen?: number;
  inserted?: number;
  updated?: number;
  reactivated?: number;
  archived?: number;
  markedMissing?: number;
  durationMs?: number;
  /** Dağıtık kilit: iki bekçi aynı kaynağın tam envanterini aynı anda işlemesin. */
  leaseUntil?: Date;
  leaseOwner?: string;
}

const SourceSyncStateSchema = new Schema<SourceSyncStateDoc>(
  {
    source: { type: String, required: true, unique: true },
    lastRunAt: Date,
    lastSuccessAt: Date,
    lastStatus: { type: String, enum: ["ok", "incomplete", "breaker", "failed"] },
    lastMessage: { type: String, default: "" },
    complete: Boolean,
    seen: Number,
    inserted: Number,
    updated: Number,
    reactivated: Number,
    archived: Number,
    markedMissing: Number,
    durationMs: Number,
    leaseUntil: Date,
    leaseOwner: String,
  },
  { timestamps: true }
);

export const SourceSyncState =
  mongoose.models.SourceSyncState ||
  mongoose.model<SourceSyncStateDoc>("SourceSyncState", SourceSyncStateSchema);
