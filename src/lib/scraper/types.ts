import { ListingSource } from "@/types";

export interface ScrapedListing {
  externalId: string;
  /** Önceki kaynak kimlikleri; mevcut kaydı güvenle eşleyip yeni kimliğe taşımak için. */
  identityAliases?: string[];
  sourceSite: ListingSource;
  listingUrl: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  /** false: kaynak bu yıl değerini vermedi, parser yalnızca geçici tahmin üretti. */
  yearVerified?: boolean;
  price: number;
  mileage: number;
  city: string;
  /** false when the source omitted the city and the adapter would otherwise need a fallback. */
  cityVerified?: boolean;
  
  address?: string;
  description: string;
  /** true ise kaynak sayfasındaki gerçek satıcı açıklaması; şablon metinler mevcut açıklamayı ezmez. */
  descriptionVerified?: boolean;
  imageUrl: string;
  images?: string[];
  damageFlag?: boolean;
  listingDate?: string;
  sellerType?: string;
  paintChange?: string;
 
  damageParts?: { name: string; state: string }[];
  /**
   * İlan sayfasında AÇIKÇA yazan (tahmin olmayan) özellikler. Doluysa kayıt güncellenirken yalnızca bunlar
   * yazılır ve ilan "özellikleri doğrulandı" sayılır; liste sayfasından gelen tahminler bunları ezmez.
   */
  confirmedFeatures?: Array<"transmission" | "fuelType" | "bodyType" | "color">;
  /** Kaynağın kategori yolu ("otomobil", "motosiklet/yamaha", "arazi-suv-pick-up/toyota-hilux"); araç tipi buradan çıkar. */
  sourceCategory?: string;
  features: {
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
  /** Detay uç noktası 404/410 ile doğruladığı ilanlar; sitemap geç güncellense de yok kanıtıdır. */
  verifiedGone?: Array<{ externalId: string; reason: string }>;
  /** Kaynak listede görülen, ancak eksik/şüpheli verisi nedeniyle yazılmayan ilan kimlikleri. */
  observedIds?: Set<string>;
  /** Kimliği çıkarılamayan kartlar: bu taramada hiçbir eski ilanı arşivleme. */
  unsafeOmissions?: number;
  /** DOD detail requests: sample size and listings with positive structured data. */
  detailChecks?: number;
  detailAlive?: number;
}

export function newCrawlReport(): CrawlReport {
  return { pages: 0, endedNaturally: false, observedIds: new Set<string>() };
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
  /** Detay doğrulama partisi: sayfası açılmaya çalışılan ilan sayısı. */
  checked?: number;
  /** ... bunlardan engel / ağ hatası yüzünden okunamayanlar (ölü ilan sayılmaz). */
  blocked?: number;
  /** Art arda çok engel gelince parti erken bırakıldı (kalan ilanlara dokunulmadı). */
  aborted?: boolean;
  sources: Array<{
    source: ListingSource;
    fetched: number;
    saved: number;
    /** Kaynak bazında yeni / güncellenen ilan sayısı (günlük özette manuel taramaların kaynaklara dağılımı için). */
    inserted?: number;
    updated?: number;
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

