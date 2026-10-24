import mongoose, { Schema, models, model } from "mongoose";

const VisitorLogSchema = new Schema(
  {
    ip: { type: String, required: true, index: true },
    country: { type: String, default: "XX", index: true },
    countryName: { type: String, default: "Bilinmiyor" },
    flag: { type: String, default: "🌐" },
    city: { type: String, default: "" },
    path: { type: String, required: true },
    device: { type: String, enum: ["desktop", "mobile", "tablet", "bot", "other"], default: "desktop" },
    browser: { type: String, default: "Bilinmiyor" },
    os: { type: String, default: "Bilinmiyor" },
    referrer: { type: String, default: "" },
    userAgent: { type: String, default: "" },

    // Kullanıcı / Hesap durumu:
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userEmail: { type: String, default: "" },
    userName: { type: String, default: "" },
    isRegistered: { type: Boolean, default: false, index: true },

    // Bot tespiti:
    isBot: { type: Boolean, default: false },
    botName: { type: String, default: "" },
  },
  { timestamps: true }
);

VisitorLogSchema.index({ createdAt: -1 });
VisitorLogSchema.index({ country: 1, createdAt: -1 });
VisitorLogSchema.index({ ip: 1, createdAt: -1 });
// 30 gun sonra otomatik temizlenir (TTL index) - DB'yi asla sisirmez:
VisitorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const VisitorLog = models.VisitorLog || model("VisitorLog", VisitorLogSchema);

export type VisitorLogDocument = mongoose.InferSchemaType<typeof VisitorLogSchema> & {
  _id: mongoose.Types.ObjectId;
};
