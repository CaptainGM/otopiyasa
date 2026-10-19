import mongoose, { Schema, model, models } from "mongoose";
import { REQUEST_STATUSES, REQUEST_TYPES } from "@/lib/support-request";

/**
 * Genel talep / şikayet kaydı (talep formu). IP adresi tutulmaz: hız sınırı kendi kısa süreli özetini kullanır.
 * Yönetici notu yalnızca yöneticilere görünür. Giriş yapılmadıysa yalnızca e-posta ve (varsa) ad saklanır.
 */
const SupportRequestSchema = new Schema(
  {
    type: { type: String, enum: REQUEST_TYPES, required: true },
    subject: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 2000 },
    email: { type: String, default: "", maxlength: 200 },
    name: { type: String, default: "", maxlength: 80 },
    user: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    car: { type: Schema.Types.ObjectId, ref: "Car", default: undefined },
    status: { type: String, enum: REQUEST_STATUSES, default: "open" },
    adminNote: { type: String, default: "", maxlength: 1000 },
    resolvedAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

SupportRequestSchema.index({ status: 1, createdAt: -1 });

export const SupportRequest = models.SupportRequest || model("SupportRequest", SupportRequestSchema);
