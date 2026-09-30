import mongoose, { Schema, models, model } from "mongoose";

const PricePointSchema = new Schema(
  {
    price: { type: Number, required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CarFeaturesSchema = new Schema(
  {
    fuelType: { type: String, required: true },
    transmission: { type: String, required: true },
    bodyType: { type: String, required: true },
    color: { type: String, required: true },
    engineSize: Number,
    horsepower: Number,
    drivetrain: String,
    avgFuelConsumption: String,
    fuelTank: String,
    topSpeed: Number,
    acceleration: Number,
    torque: Number,
    safetyFeatures: { type: [String], default: undefined },
    specSource: String,
  },
  { _id: false }
);

const CarSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true, index: true },
    model: { type: String, required: true, trim: true, index: true },
    year: { type: Number, required: true, index: true },
    price: { type: Number, required: true, index: true },
    mileage: { type: Number, required: true },
    city: { type: String, required: true },
    address: { type: String, default: "" },
    description: { type: String, default: "" },

    imageUrl: { type: String, default: "" },
    images: { type: [String], default: [] },
    damageFlag: { type: Boolean, default: false },
    location: {
      lat: Number,
      lng: Number,
    },
    features: { type: CarFeaturesSchema, required: true },
    listingDate: { type: String, default: "" },
    sellerType: { type: String, default: "" },
    paintChange: { type: String, default: "" },
    source: { type: String, default: "demo" },
    sourceSite: {
      type: String,
      enum: ["sahibinden", "arabam", "otomerkezi", "vavacars", "otoplus", "carvak", "otokoc", "dod", "ikinciyeni", "demo", "manual", "user"],
      default: "demo",
      index: true,
    },
    listingUrl: { type: String, default: "" },
    externalId: { type: String, default: "", index: true },
    priceHistory: { type: [PricePointSchema], default: [] },
  
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
   
    moderationStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: undefined,
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    
    status: {
      type: String,
      enum: ["active", "sold", "removed"],
      default: "active",
      index: true,
    },
    viewCount: { type: Number, default: 0 },
  
    damageParts: {
      type: [{ name: String, state: String, _id: false }],
      default: [],
    },
    contactPhone: { type: String, default: "" },
  
    minOffer: { type: Number, default: 0 },
   
    businessName: { type: String, default: "" },
    lastDetailChange: {
      field: { type: String, default: "" },
      summary: { type: String, default: "" },
      changedAt: { type: Date, default: undefined },
    },

    // --- İlan yaşam döngüsü (doğrulama) ---
    // updatedAt yalnızca "ilanın içeriği değişti" demektir. Kaynağa gidip ilanın
    // hâlâ yayında olduğunu teyit ettiğimiz an ayrı tutulur; aksi hâlde her
    // kontrol updatedAt'i oynatıp "son değişiklik" bilgisini bozuyordu.
    lastVerifiedAt: { type: Date, default: undefined },
    // Son doğrulama DENEMESİ (başarılı ya da engellenmiş). Kuyruğun aynı
    // erişilemeyen ilanlarda takılı kalmaması için kullanılır.
    lastVerifyAttemptAt: { type: Date, default: undefined },
    // Zayıf "kaynakta yok" sinyali (ör. tam envanterde görünmedi). Tek başına
    // arşivletmez; tekrar eden gözlemle teyit edilir (bkz. listing-lifecycle.ts).
    missingSince: { type: Date, default: undefined },
    missingChecks: { type: Number, default: undefined },
    removedAt: { type: Date, default: undefined },
    removedReason: { type: String, default: undefined },
    // Arabam sitemap'inde görünmediği ilk an: yalnızca detay taramasını önceliklendirir,
    // arşiv kararı vermez (sitemap eksik; ölçümde görünmeyenlerin çoğu hâlâ yayındaydı).
    sitemapMissingSince: { type: Date, default: undefined },
    // Arşivde ama kaynakta hâlâ yayında olabilir → bir sonraki detay taramasında yeniden kontrol et.
    needsRecheck: { type: Boolean, default: undefined },
  },
  { timestamps: true }
);

CarSchema.index({ brand: 1, model: 1, year: 1 });
CarSchema.index({ sourceSite: 1, externalId: 1 }, { unique: true, sparse: true });
CarSchema.index({ title: "text", brand: "text", model: "text" });

CarSchema.index({ status: 1, createdAt: -1 });
CarSchema.index({ status: 1, moderationStatus: 1, createdAt: -1 });
CarSchema.index({ status: 1, viewCount: -1 });
CarSchema.index({ status: 1, updatedAt: -1 });
CarSchema.index({ status: 1, updatedAt: 1 });
CarSchema.index({ updatedAt: 1 });
CarSchema.index({ status: 1, moderationStatus: 1, updatedAt: -1 });
CarSchema.index({ status: 1, city: 1, updatedAt: -1 });
CarSchema.index({ status: 1, brand: 1, model: 1, year: 1 });
CarSchema.index({ status: 1, moderationStatus: 1, price: 1 });
CarSchema.index({ status: 1, price: 1 });
// Ana sayfa varsayılan akışı { createdAt: -1, _id: -1 } ile sıralanıyor; _id'yi
// içermeyen indeksle Mongo 28 bin belgeyi bellekte sıralıyordu (~1,1 sn → ~5 ms).
CarSchema.index({ status: 1, createdAt: -1, _id: -1 });
CarSchema.index({ sourceSite: 1, status: 1, lastVerifiedAt: 1 });

export const Car = models.Car || model("Car", CarSchema);

export type CarDocument = mongoose.InferSchemaType<typeof CarSchema> & {
  _id: mongoose.Types.ObjectId;
};
