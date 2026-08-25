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
      enum: ["sahibinden", "arabam", "otomerkezi", "demo", "manual", "user"],
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
  },
  { timestamps: true }
);

CarSchema.index({ brand: 1, model: 1, year: 1 });
CarSchema.index({ sourceSite: 1, externalId: 1 }, { unique: true, sparse: true });
CarSchema.index({ title: "text", brand: "text", model: "text" });

export const Car = models.Car || model("Car", CarSchema);

export type CarDocument = mongoose.InferSchemaType<typeof CarSchema> & {
  _id: mongoose.Types.ObjectId;
};
