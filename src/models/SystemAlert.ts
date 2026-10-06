import mongoose, { Schema } from "mongoose";

/**
 * Sağlık denetiminin bulduğu sorunlar (bkz. lib/health-check.ts). Aynı sorun için yöneticiye günde en fazla bir kez
 * haber verilir; sorun kendiliğinden düzelince `resolvedAt` yazılır ve bir kez "düzeldi" bildirimi gider.
 */
export interface SystemAlertDoc {
  key: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastNotifiedAt?: Date | null;
  resolvedAt?: Date | null;
}

const SystemAlertSchema = new Schema<SystemAlertDoc>(
  {
    key: { type: String, required: true, unique: true },
    severity: { type: String, enum: ["critical", "warning"], default: "warning" },
    title: { type: String, required: true },
    detail: { type: String, default: "" },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    lastNotifiedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const SystemAlert =
  mongoose.models.SystemAlert || mongoose.model<SystemAlertDoc>("SystemAlert", SystemAlertSchema);
