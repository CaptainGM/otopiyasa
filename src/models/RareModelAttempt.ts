import mongoose, { Schema, models, model } from "mongoose";

/**
 * "Nadir model" taramasının aile bazlı deneme kaydı: bir aile aranınca kaynakta kaç yeni ilan bulundu. Hâlâ az kalan (kaynakta da
 * az olan) aile bir süre yeniden aranmaz; aksi halde aynı en nadir aileler her turda boşuna hedeflenirdi.
 */
const RareModelAttemptSchema = new Schema(
  {
    brand: { type: String, required: true },
    familyKey: { type: String, required: true },
    model: { type: String, default: "" },
    attemptedAt: { type: Date, required: true },
    /** O denemede kaydedilen yeni ilan sayısı. */
    added: { type: Number, default: 0 },
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
