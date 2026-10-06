import mongoose, { Schema } from "mongoose";

/**
 * Bekçinin liste sayfası taraması için model ailesi başına durum (bkz. lib/scraper/arabam-list-sweep.ts).
 * Hangi sayfada kalındığı, kaynaktaki toplam ilan ve bizdeki ilan oranı burada tutulur ki bekçi yeniden
 * başladığında aynı sayfaları baştan gezmesin.
 */
export interface ArabamListSweepDoc {
  key: string;
  brand: string;
  model: string;
  /** Doğrulanmamış (vitesi tahmin) aktif ilanımız sayısı, plan anında. */
  unverified: number;
  /** Ailedeki tüm aktif ilanlarımız, plan anında. */
  ours: number;
  suvLikely?: boolean;
  /** Ailedeki ilanlarımızın çoğunluk araç tipi (liste sayfası kategorisi buna göre seçilir). */
  vehicleClass?: string;
  /** Kaynaktaki model sayfası yolu, ör. "arazi-suv-pick-up/chevrolet-captiva". */
  path?: string | null;
  total?: number | null;
  totalPages?: number | null;
  nextPage: number;
  pagesFetched: number;
  matched: number;
  bodyType?: string | null;
  /** Kaynakta model sayfası bulunamadı ya da tamamı gezildi: bu tarihe kadar seçilmez. */
  skipUntil?: Date | null;
  lastFetchedAt?: Date | null;
  note?: string;
}

const ArabamListSweepSchema = new Schema<ArabamListSweepDoc>(
  {
    key: { type: String, required: true, unique: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    unverified: { type: Number, default: 0 },
    ours: { type: Number, default: 0 },
    suvLikely: Boolean,
    vehicleClass: { type: String, default: "otomobil" },
    path: { type: String, default: null },
    total: { type: Number, default: null },
    totalPages: { type: Number, default: null },
    nextPage: { type: Number, default: 1 },
    pagesFetched: { type: Number, default: 0 },
    matched: { type: Number, default: 0 },
    bodyType: { type: String, default: null },
    skipUntil: { type: Date, default: null },
    lastFetchedAt: { type: Date, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export const ArabamListSweep =
  mongoose.models.ArabamListSweep || mongoose.model<ArabamListSweepDoc>("ArabamListSweep", ArabamListSweepSchema);
