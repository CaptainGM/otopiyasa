import mongoose, { Schema, models, model } from "mongoose";

export interface IManualScrapeLog {
  _id: mongoose.Types.ObjectId;
  actor: string; // E-posta veya "admin" / "system" / "Terminal (scrape.bat)"
  source: string; // "all", "arabam", "otomerkezi", "vavacars", "otoplus", "carvak", "otokoc", "dod", "ikinciyeni", "rare-model", "price-refresh"
  label: string; // İnsan tarafından okunabilir başlık
  scanned: number;
  inserted: number;
  updated: number;
  deleted: number;
  durationSeconds: number;
  status: "success" | "partial" | "error";
  message?: string;
  bySource?: Record<
    string,
    { fetched?: number; saved?: number; scanned?: number; inserted?: number; updated?: number }
  >;
  sampleVehicles?: Array<{
    brand: string;
    model: string;
    year: number;
    price: number;
    source: string;
    title?: string;
    imageUrl?: string;
  }>;
  createdAt: Date;
}

const ManualScrapeLogSchema = new Schema<IManualScrapeLog>(
  {
    actor: { type: String, required: true, index: true, default: "Yönetici" },
    source: { type: String, required: true, index: true },
    label: { type: String, default: "" },
    scanned: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    deleted: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    status: { type: String, enum: ["success", "partial", "error"], default: "success" },
    message: { type: String, default: "" },
    bySource: { type: Schema.Types.Mixed, default: {} },
    sampleVehicles: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ManualScrapeLogSchema.index({ createdAt: -1 });

export const ManualScrapeLog =
  models.ManualScrapeLog || model<IManualScrapeLog>("ManualScrapeLog", ManualScrapeLogSchema);

