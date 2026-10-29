export type ListingSource = "sahibinden" | "arabam" | "otomerkezi" | "vavacars" | "otoplus" | "carvak" | "otokoc" | "dod" | "ikinciyeni" | "demo" | "manual" | "user";

export interface CarFeatures {
  fuelType: string;
  transmission: string;
  bodyType: string;
  color: string;
  engineSize?: number;
  horsepower?: number;
  
  drivetrain?: string; 
  avgFuelConsumption?: string; 
  avgFuelConsumptionSource?: "listing" | "model-median";
  fuelTank?: string; 

  topSpeed?: number; 
  acceleration?: number; 
  torque?: number; 
  specSource?: string; 
}

export interface PricePoint {
  price: number;
  recordedAt: string;
}

export interface TechnicalSpecs {
  acceleration?: number;
  topSpeed?: number;
  torque?: number;
  trunkCapacity?: number;
  fuelTank?: string;
  curbWeight?: number;
  /** "web": internetten doğrulanmış motor varyantı değeri (sourceUrl). Diğerleri gösterilmez. */
  specSource?: "web" | "catalog" | "derived" | "listing";
  sourceUrl?: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  present: boolean;
  /** "var" | "yok" | "bilinmiyor" (ilan metninde hiç geçmiyor; "yok" değildir). Eski istemciler yalnızca `present` okur. */
  status?: "var" | "yok" | "bilinmiyor";
}

export interface EquipmentCategory {
  id: "safety" | "comfort" | "exterior" | "multimedia";
  title: string;
  items: EquipmentItem[];
}

export interface Car {
  _id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  address?: string;
  
  description: string;
  imageUrl: string;
  images?: string[];
  damageFlag?: boolean;
  features: CarFeatures;
  source: string;
  sourceSite: ListingSource;
  listingUrl?: string;
  externalId?: string;
  listingDate?: string; 
  sellerType?: string; 
  paintChange?: string;
 
  damageParts?: { name: string; state: string }[];

  ownerId?: string;
  moderationStatus?: "approved" | "pending" | "rejected";
  rejectionReason?: string;

  status?: "active" | "sold" | "removed";
  vehicleClass?: string;
  /** Kaynağa gidilip ilanın yayında olduğunun son teyit edildiği an. */
  lastVerifiedAt?: string;
  /** Kaynaktan kaldırıldığı tespit edilip arşive taşındığı an. */
  removedAt?: string;
  /** Arşive taşınma gerekçesi (yalnızca yönetici görünümünde dolu). */
  removedReason?: string;
  viewCount?: number;
  contactPhone?: string;
 
  minOffer?: number;
  businessName?: string; 
  /** Adil piyasa değeri (km, hasar, donanıma göre; bkz. lib/market-fair.ts) ve emsal sayısı. */
  fairPrice?: number;
  fairSample?: number;
  marketAvgPrice?: number;
  marketListingCount?: number;
  /** "family": donanımda emsal yetmediği için aynı yılın tüm donanımları birlikte sayıldı. */
  marketScope?: "model" | "family";
  marketFamilyLabel?: string;
  /** Yeni ilan (üç saatten yeni) ve adil değeri henüz hesaplanmadı: kartta "Piyasa verisi az" yerine "Hesaplanıyor" yazılır. */
  marketPending?: boolean;
  priceVsMarket?: number;
  /** Fabrika teknik verileri (0-100 hızlanma, tork, azami hız, bagaj vb.) */
  technicalSpecs?: TechnicalSpecs;
  /** Doğrulanmış donanım karşılaştırma matrisi */
  equipmentCategories?: EquipmentCategory[];
  priceHistory: PricePoint[];
  createdAt: string;
  updatedAt: string;
}

/** Only the fields rendered by a listing row; keeps initial/RSC page payloads small. */
export type CarListItem = Pick<
  Car,
  | "_id"
  | "title"
  | "year"
  | "price"
  | "mileage"
  | "city"
  | "vehicleClass"
  | "imageUrl"
  | "damageFlag"
  | "sourceSite"
  | "listingDate"
  | "marketAvgPrice"
  | "marketListingCount"
  | "marketPending"
  | "status"
> & {
  /** Kart başlığı marka + model (ilan başlığı satıcının serbest metni, ikinci satırda). */
  brand?: string;
  /** Adil piyasa değeri ve dayandığı emsal sayısı (ilan sayfasındaki fiyat analiziyle aynı; bkz. lib/market-fair.ts). */
  fairPrice?: number;
  fairSample?: number;
  model?: string;
  images: string[];
  features: Pick<CarFeatures, "fuelType" | "transmission">;
  /** Fabrika teknik verileri (0-100 hızlanma, tork, azami hız, bagaj vb.) */
  technicalSpecs?: TechnicalSpecs;
  /** Doğrulanmış donanım karşılaştırma matrisi */
  equipmentCategories?: EquipmentCategory[];
  priceHistory: PricePoint[];
};

export interface User {
  _id: string;
  name: string;
  email: string;
  favorites: string[];
  createdAt: string;
}

export interface CarFilters {
  q?: string;
  brand?: string;
  model?: string;
  city?: string;
  color?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  /** Kilometre aralığı (en az / en çok). */
  mileageMin?: number;
  mileageMax?: number;
  /** Satıcı tipi: galeriden satılan ya da bireysel (kişinin kendi sattığı) ilanlar. */
  seller?: "galeriden" | "bireysel";
  /** Yalnızca hasar kaydı olmayan ilanlar. */
  noDamage?: boolean;
  fuelType?: string;
  transmission?: string;
  /** Araç tipi (bkz. lib/vehicle-scope.ts VEHICLE_CLASSES). */
  vehicleClass?: string;
  /** Yalnızca olağan dışı fiyatı olduğu daha önce doğrulanmış ilanları gizle. */
  excludeOutliers?: boolean;
  sort?: "mixed" | "price_asc" | "price_desc" | "year_desc" | "newest" | "views" | "deal";
  discountOnly?: boolean;
  /** Yalnızca "Haftanın fırsatları" ölçütündeki ilanlar (bkz. lib/market-fair.ts isDealCandidate). */
  deals?: boolean;
  /** "Keşfet" akışının kişiye/yenilemeye özel rastgele başlangıç tohumu; sonraki sayfalar aynı tohumu kullanır. */
  seed?: number;
  /** Keşfet dilimi (0..23) ve dönemi: herkes için aynı, CDN'de saklanır; sıra istemcide karıştırılır. */
  slot?: number;
  bucket?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedCars {
  items: Car[];
  total: number;
  page: number;
  totalPages: number;
}

export interface BrandStats {
  brand: string;
  count: number;
  avgPrice: number;
}

export interface YearStats {
  year: number;
  count: number;
  avgPrice: number;
}

export interface StatsResponse {
  byBrand: BrandStats[];
  byYear: YearStats[];
  overallAvgPrice: number;
  totalCars: number;
}

export interface Comment {
  _id: string;
  car: string;
  user: {
    _id: string;
    name: string;
  } | string;
  text: string;
  rating: number;
  createdAt: string;
  sentiment?: "positive" | "neutral" | "negative";
}
