import { Schema, models, model } from "mongoose";

/**
 * Ağır hesaplanan tek satırlık istatistikler (ör. ana sayfadaki "öne çıkan ilan" sayısı). Hesap daemon'da (saatlik piyasa
 * turu) yapılır ve buraya yazılır; web sunucusu yalnızca bu küçük kaydı okur. Böylece her önbellek kaçırmada tüm ilanlar
 * taranmaz (Vercel işlemci kotası).
 */
const MarketStatSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

export const MarketStat = models.MarketStat || model("MarketStat", MarketStatSchema);
