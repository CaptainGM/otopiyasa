import mongoose, { Schema } from "mongoose";

/**
 * Günlük akaryakıt fiyatları (vergiler dahil, TL/lt). Tek belge ("latest") tutulur; motor ve
 * site belge eskidiyse kaynaktan yeniler (bkz. lib/fuel-prices.ts).
 */
export interface FuelPriceCity {
  /** Karşılaştırma anahtarı: büyük harf, Türkçe harfsiz ("ISTANBUL (AVRUPA)"). */
  key: string;
  name: string;
  benzin?: number;
  dizel?: number;
  lpg?: number;
}

export interface FuelPriceDoc {
  name: string;
  source: string;
  fetchedAt: Date;
  cities: FuelPriceCity[];
  average: { benzin?: number; dizel?: number; lpg?: number };
}

const FuelPriceSchema = new Schema<FuelPriceDoc>(
  {
    name: { type: String, required: true, unique: true },
    source: { type: String, default: "" },
    fetchedAt: { type: Date, required: true },
    cities: {
      type: [{ key: String, name: String, benzin: Number, dizel: Number, lpg: Number, _id: false }],
      default: [],
    },
    average: { benzin: Number, dizel: Number, lpg: Number },
  },
  { timestamps: true }
);

export const FuelPrice =
  mongoose.models.FuelPrice || mongoose.model<FuelPriceDoc>("FuelPrice", FuelPriceSchema);
