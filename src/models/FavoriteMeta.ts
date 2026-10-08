import mongoose, { Schema, models, model } from "mongoose";

/**
 * Kullanıcının bir favori ilan için ayarları: kişisel not ve fiyat bildirimi tercihi.
 * Kayıt yalnızca varsayılandan farklı bir şey seçildiğinde tutulur; kaydı olmayan favori "her fiyat düşüşünde, e-posta + mobil
 * bildirim" davranışını sürdürür (eski davranış).
 */
const FavoriteMetaSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    carId: { type: Schema.Types.ObjectId, ref: "Car", required: true },
    note: { type: String, default: "", maxlength: 300 },
    /** any: her fiyat düşüşünde, below: belirlenen fiyatın altına düşünce, off: bildirim yok. */
    alertMode: { type: String, enum: ["any", "below", "off"], default: "any" },
    alertBelow: { type: Number, default: null },
    alertEmail: { type: Boolean, default: true },
    alertPush: { type: Boolean, default: true },
  },
  { timestamps: true }
);

FavoriteMetaSchema.index({ userId: 1, carId: 1 }, { unique: true });
FavoriteMetaSchema.index({ carId: 1 });

export const FavoriteMeta = models.FavoriteMeta || model("FavoriteMeta", FavoriteMetaSchema);

export type FavoriteMetaDocument = mongoose.InferSchemaType<typeof FavoriteMetaSchema> & {
  _id: mongoose.Types.ObjectId;
};
