import { Schema, models, model } from "mongoose";

/**
 * Yönetim panelindeki "Site özellikleri" sağlık kontrolünün son sonucu (özellik başına tek belge). Sunucusuz fonksiyonların belleği
 * paylaşılmadığı için sonuçlar burada tutulur; ağır ve yapay zekâ kontrolleri her sorguda değil, süresi dolunca yeniden çalışır.
 */
const FeatureProbeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    ok: { type: Boolean, required: true },
    detail: { type: String, default: "" },
    ms: { type: Number, default: 0 },
    checkedAt: { type: Date, required: true },
    lastOkAt: { type: Date, default: null },
  },
  { timestamps: false }
);

export const FeatureProbe = models.FeatureProbe || model("FeatureProbe", FeatureProbeSchema);
