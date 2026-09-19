import mongoose from "mongoose";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const brandImages = {
  Toyota:
    "https://images.unsplash.com/photo-1623869675781-0ecb64375144?auto=format&fit=crop&w=1200&q=80",
  Honda:
    "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
  Volkswagen:
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80",
  BMW:
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80",
  Renault:
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80",
  Mercedes:
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80",
  Ford:
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80",
  Hyundai:
    "https://images.unsplash.com/photo-1609521263047-f8f205293bb4?auto=format&fit=crop&w=1200&q=80",
  Audi:
    "https://images.unsplash.com/photo-1603584171295-0a4f46994906?auto=format&fit=crop&w=1200&q=80",
  Fiat:
    "https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=1200&q=80",
  Tesla:
    "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80",
  Peugeot:
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const seedCars = JSON.parse(
  readFileSync(join(__dirname, "seed-cars.json"), "utf-8")
).map((car, index) => ({
  ...car,
  imageUrl: brandImages[car.brand] || car.imageUrl,
  sourceSite: index % 2 === 0 ? "sahibinden" : "arabam",
  source: index % 2 === 0 ? "sahibinden" : "arabam",
  externalId: `demo-${index + 1}`,
  listingUrl:
    index % 2 === 0
      ? `https://www.sahibinden.com/ilan/demo-${index + 1}`
      : `https://www.arabam.com/ilan/demo-${index + 1}`,
  priceHistory: car.priceHistory.map((point) => ({
    ...point,
    recordedAt: new Date(point.recordedAt),
  })),
}));

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/otopiyasa";

const CarSchema = new mongoose.Schema(
  {
    title: String,
    brand: String,
    model: String,
    year: Number,
    price: Number,
    mileage: Number,
    city: String,
    description: String,
    imageUrl: String,
    features: Object,
    source: String,
    sourceSite: String,
    listingUrl: String,
    externalId: String,
    priceHistory: Array,
  },
  { timestamps: true }
);

const Car = mongoose.models.Car || mongoose.model("Car", CarSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  await Car.deleteMany({});
  await Car.insertMany(seedCars);
  console.log(`${seedCars.length} demo araç yüklendi.`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
