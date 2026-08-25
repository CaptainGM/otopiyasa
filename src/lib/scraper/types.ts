import { ListingSource } from "@/types";

export interface ScrapedListing {
  externalId: string;
  sourceSite: ListingSource;
  listingUrl: string;
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
  listingDate?: string;
  sellerType?: string;
  paintChange?: string;
 
  damageParts?: { name: string; state: string }[];
  features: {
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
  };
}


export type OnListing = (listing: ScrapedListing) => Promise<void>;

export interface ScrapeAdapter {
  id: ListingSource;
  label: string;
  
  scrape(query: string, limit: number, onListing: OnListing): Promise<{ fetched: number }>;
}

export interface ScrapeJobResult {
  success: boolean;
  message: string;
  inserted: number;
  updated: number;
  sources: Array<{
    source: ListingSource;
    fetched: number;
    saved: number;
  }>;
}
