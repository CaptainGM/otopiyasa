import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
   
    canonicalEmail: { type: String, index: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    favorites: [{ type: Schema.Types.ObjectId, ref: "Car" }],
    // Kullanıcının kendi favori listeleri (sedan, SUV...); "Favori Listem" varsayılan listesi saklanmaz, hesaplanır. Bir ilan en fazla tek listededir ve her zaman `favorites` içindedir:
    // listeye koymak favorilere de ekler, favoriden çıkarmak ilanı listesinden de çıkarır.
    favoriteLists: [
      {
        name: { type: String, required: true, trim: true, maxlength: 40 },
        carIds: [{ type: Schema.Types.ObjectId, ref: "Car" }],
      },
    ],
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
    // Mobil uygulamada şifre sıfırlama: e-postaya giden 6 haneli kod (bağlantı akışından ayrı tutulur)
    resetCodeHash: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },
    resetCodeAttempts: { type: Number, default: 0 },
   
    emailVerified: { type: Boolean, default: false },
    verifyTokenHash: { type: String, default: null },
    verifyTokenExpires: { type: Date, default: null },
    // "Doğrulama e-postasını tekrar gönder" hakkı hesap başına en fazla 3 (posta sağlayıcısının günlük kotası sınırlı).
    verifyResendCount: { type: Number, default: 0 },
    // Adres değişikliği bilgilendirmesi (scripts/notify-domain-change.ts) gönderildiyse zamanı; ikinci kez gönderilmez.
    domainNoticeAt: { type: Date, default: null },
  
    accountType: { type: String, enum: ["individual", "business"], default: "individual" },
    businessName: { type: String, default: "" },
    businessPhone: { type: String, default: "" },
    businessStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    businessRejectionReason: { type: String, default: "" },

  
    emailChangePendingEmail: { type: String, default: null },
    emailChangeCurrentCodeHash: { type: String, default: null },
    emailChangeNewCodeHash: { type: String, default: null },
    emailChangeCodeExpires: { type: Date, default: null },
    emailChangeAttempts: { type: Number, default: 0 },

    
    chatSuspendedUntil: { type: Date, default: null },
   
    muteCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.index({ favorites: 1 });

export const User = models.User || model("User", UserSchema);

export type UserDocument = mongoose.InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};
