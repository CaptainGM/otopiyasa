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
    /** Son doğrulama denemesi sonuçsuz kaldıysa nedeni: blocked (bot engeli), error, gone-held (kaldırılmış görünüyor, güvenlik freni arşivlemedi). */
    lastVerifyStatus: { type: String, default: undefined },
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
    // Keşfet için bağımsız ve indeksli tam liste sıralamaları.
    rand: { type: Number, default: () => Math.random() },
    rand2: { type: Number, default: () => Math.random() },
    rand3: { type: Number, default: () => Math.random() },
    rand4: { type: Number, default: () => Math.random() },
    // İlan sayfasından galeri/açıklama/teknik bilgi en son ne zaman tamamlanmaya çalışıldı
    // (Otokoç, Otoplus; bkz. scraper/enrich-detail.ts).
    detailCheckedAt: { type: Date, default: undefined },
    /** Vites/yakıt/kasa gibi özelliklerin ilan sayfasından doğrulandığı an (liste sayfası verisi tahmindir). */
    featuresVerifiedAt: { type: Date, default: undefined },
    /**
     * Kaynaktan tek tek doğrulanmış özellikler ("transmission", "fuelType", "color", "bodyType"). Liste sayfasının
     * gömülü verisi vites/yakıt/rengi verir ama kasa tipini vermez; analiz her özellik için yalnızca doğrulanmışı sayar.
     */
    verifiedFeatures: { type: [String], default: undefined },
    /**
     * Araç tipi: "otomobil" | "suv-pickup" | "minivan-panelvan" | "ticari" | "motosiklet" | "karavan"
     * (bkz. lib/vehicle-scope.ts). Liste filtresi ve analiz tipleri karıştırmasın diye.
     */
    vehicleClass: { type: String, default: undefined },
    /**
     * Bir kullanıcı ilanı açtı ve kaynaktaki son kontrol eski: bekçi bu ilanı sıranın başına alır (bkz.
     * listing-lifecycle.ts requestPriorityVerify). Kontrol edilince silinir.
     */
    verifyPriorityAt: { type: Date, default: undefined },
    /**
     * Segmentin piyasa ortalaması (saatlik anlık görüntü, bkz. lib/market-snapshot.ts): kartlardaki ucuz/adil/pahalı
     * göstergesi her istekte hesaplanmasın diye. scope "family": aynı yılın tüm donanımları birlikte sayıldı.
     */
    market: {
      type: new Schema(
        {
          avg: Number,
          count: Number,
          scope: String,
          at: Date,
          /**
           * Adil piyasa değeri: ilan sayfasındaki fiyat analiziyle AYNI hesap (predictPrice: model yılı, km, hasar,
           * donanım). Kartlardaki gösterge, ilan sayfası ve fırsatlar bu tek sayıyı kullanır (bkz. lib/market-fair.ts).
           */
          fair: Number,
          /** Adil değerin dayandığı emsal ilan sayısı. */
          fairN: Number,
          /** (adil − fiyat) / adil: artı = piyasanın altında. */
          disc: Number,
          /** "Haftanın fırsatları" ölçütünü karşılıyor mu (bkz. isDealCandidate). */
          deal: Boolean,
          /** Hesaplandığı andaki fiyat (fiyat değişince yeniden hesaplanır). */
          fp: Number,
          fairAt: Date,
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

CarSchema.index({ brand: 1, model: 1, year: 1 });
CarSchema.index({ sourceSite: 1, externalId: 1 }, { unique: true, sparse: true });
CarSchema.index({ title: "text", brand: "text", model: "text" });

CarSchema.index({ status: 1, createdAt: -1 });
CarSchema.index({ status: 1, vehicleClass: 1, createdAt: -1 });
CarSchema.index({ verifyPriorityAt: 1 }, { sparse: true });
// "Haftanın fırsatları" ve tümü listesi: fırsat ilanlar indirime göre sıralı (bkz. lib/market-fair.ts).
CarSchema.index({ "market.deal": 1, "market.disc": -1 }, { sparse: true });
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
CarSchema.index({ status: 1, rand: 1 });
CarSchema.index({ status: 1, rand2: 1 });
CarSchema.index({ status: 1, rand3: 1 });
CarSchema.index({ status: 1, rand4: 1 });
// Ana sayfa varsayılan akışı { createdAt: -1, _id: -1 } ile sıralanıyor; _id'yi
// içermeyen indeksle Mongo 28 bin belgeyi bellekte sıralıyordu (~1,1 sn → ~5 ms).
CarSchema.index({ status: 1, createdAt: -1, _id: -1 });
// Arabam bekçisi panelinde saat saat "arşive giden / yeni eklenen" listesi için
// (kaynak + durum + tarih aralığı); bu olmadan arşiv büyüdükçe tüm "removed" kayıtları taranırdı.
CarSchema.index({ sourceSite: 1, status: 1, removedAt: -1 });
CarSchema.index({ sourceSite: 1, createdAt: -1 });
CarSchema.index({ sourceSite: 1, status: 1, lastVerifiedAt: 1 });

export const Car = models.Car || model("Car", CarSchema);

export type CarDocument = mongoose.InferSchemaType<typeof CarSchema> & {
  _id: mongoose.Types.ObjectId;
};
