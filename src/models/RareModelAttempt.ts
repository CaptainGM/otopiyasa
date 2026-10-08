import mongoose, { Schema, models, model } from "mongoose";

/**
 * "Nadir model" taramasının aile bazlı deneme kaydı: bir aile aranınca kaynakta kaç yeni ilan bulundu. Hâlâ az kalan (kaynakta da
 * az olan) aile 14 gün aranmaz; aksi halde aynı en nadir aileler her turda boşuna hedeflenirdi.
 */
const RareModelAttemptSchema = new Schema(
  {
    brand: { type: String, required: true },
    familyKey: { type: String, required: true },
    model: { type: String, default: "" },
    attemptedAt: { type: Date, required: true },
    /** O denemede kaydedilen yeni ilan sayısı. */
    added: { type: Number, default: 0 },
    /** Kaynakta bulunan ilan sayısı (sayfa başına 20 ile sınırlı); azsa kaynakta o aile tükenmiş demektir. */
    found: { type: Number, default: 0 },
    /** Bu aile kaç gün sonra yeniden denenir (kaynakta daha fazlası varsa 3, tükenmişse 14). */
    retryAfterDays: { type: Number, default: 3 },
    /** Denemeden önceki / sonraki toplam aile ilan sayısı. */
    before: { type: Number, default: 0 },
    after: { type: Number, default: 0 },
  },
  { timestamps: false }
);

RareModelAttemptSchema.index({ brand: 1, familyKey: 1 }, { unique: true });

export const RareModelAttempt = models.RareModelAttempt || model("RareModelAttempt", RareModelAttemptSchema);

export type RareModelAttemptDocument = mongoose.InferSchemaType<typeof RareModelAttemptSchema> & {
  _id: mongoose.Types.ObjectId;
};
