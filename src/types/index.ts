export type ListingSource = "sahibinden" | "arabam" | "otomerkezi" | "demo" | "manual" | "user";

export interface CarFeatures {
  fuelType: string;
  transmission: string;
  bodyType: string;
  color: string;
  engineSize?: number;
  horsepower?: number;
  
  drivetrain?: string; 
  avgFuelConsumption?: string; 
  fuelTank?: string; 

  topSpeed?: number; 
  acceleration?: number; 
  torque?: number; 
  safetyFeatures?: string[];
  specSource?: string; 
}

export interface PricePoint {
  price: number;
  recordedAt: string;
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
  location?: { lat: number; lng: number };
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
  viewCount?: number;
  contactPhone?: string;
 
  minOffer?: number;
  businessName?: string; 
  marketAvgPrice?: number;
  marketListingCount?: number;
  priceVsMarket?: number;
  priceHistory: PricePoint[];
  createdAt: string;
  updatedAt: string;
}

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
  fuelType?: string;
  transmission?: string;
  sort?: "mixed" | "price_asc" | "price_desc" | "year_desc" | "newest" | "views";
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
