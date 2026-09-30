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

/**
 * Bir envanter taramasının nasıl bittiğini raporlar. "Hata yüzünden yarıda
 * kaldı" ile "son sayfaya ulaşıldı" ayrımı hayati: yalnızca TAMAMLANMIŞ bir
 * taramada görünmeyen ilan "kaynakta yok" sayılabilir.
 */
export interface CrawlReport {
  pages: number;
  /** Son sayfanın ötesine geçildi (boş sayfa / 404 / kısa sayfa). */
  endedNaturally: boolean;
  error?: string;
  /** Kaynağın kendi bildirdiği toplam (biliniyorsa). */
  expectedTotal?: number;
}

export function newCrawlReport(): CrawlReport {
  return { pages: 0, endedNaturally: false };
}

export interface ScrapeAdapter {
  id: ListingSource;
  label: string;
  
  scrape(query: string, limit: number, onListing: OnListing, pageOffset?: number): Promise<{ fetched: number }>;
}

export interface ScrapeJobResult {
  success: boolean;
  message: string;
  inserted: number;
  updated: number;
  unchanged?: number;
  deleted?: number;
  /** Arşivdeyken kaynakta yeniden görülüp aktife alınan ilanlar. */
  reactivated?: number;
  sources: Array<{
    source: ListingSource;
    fetched: number;
    saved: number;
  }>;
  sampleVehicles?: Array<{
    brand: string;
    model: string;
    year: number;
    price: number;
    source: string;
    title?: string;
    imageUrl?: string;
  }>;
}

