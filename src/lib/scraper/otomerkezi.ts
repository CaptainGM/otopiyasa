import { cityToCoords } from "@/lib/city-coords";
import { normalizeBrand } from "@/lib/normalize-brand";
import { fetchPageHtml } from "@/lib/scraper/browser-scrape";
import { reportProgress } from "@/lib/scraper/progress";
import { ScrapedListing } from "@/lib/scraper/types";



const LIST_URL = "https://www.otomerkezi.net/ikinci-el";
const ITEMS_PER_PAGE = 15;
const MAX_PAGES = 20;

const FUEL_MAP: Record<string, string> = {
  gasoline: "Benzin",
  petrol: "Benzin",
  diesel: "Dizel",
  lpg: "LPG",
  hybrid: "Hibrit",
  electric: "Elektrik",
};

const TRANSMISSION_MAP: Record<string, string> = {
  automatic: "Otomatik",
  manual: "Manuel",
  "semi-automatic": "Yarı Otomatik",
};

interface LdItem {
  url?: string;
  name?: string;
  brand?: { name?: string };
  model?: string;
  image?: string[];
  description?: string;
  productionDate?: string;
  fuelType?: string;
  vehicleTransmission?: string;
  offers?: {
    price?: number;
    seller?: { address?: { addressLocality?: string } };
  };
}

function titleCase(value: string) {
  
  return value
    .replace(/İ/g, "I")
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}


const BODY_TYPE_PATTERNS: [RegExp, string][] = [
  [/suv|crossover|arazi/i, "SUV"],
  [/pick[\s-]?up|kamyonet/i, "Pick-up"],
  [/\bvan\b|minibüs|minibus|panelvan/i, "Van"],
  [/hat[cs]?h?back|\bhb\b/i, "Hatchback"],
  [/station\s?wagon|karavan/i, "Station wagon"],
  [/cabrio|convertible|roadster/i, "Cabrio"],
  [/coupe|coupé/i, "Coupe"],
  [/\bsedan\b/i, "Sedan"],
];

function bodyTypeFromDescription(description: string): string | null {
  for (const [pattern, label] of BODY_TYPE_PATTERNS) {
    if (pattern.test(description)) return label;
  }
  return null;
}

function mileageFromDescription(description: string) {
  const match = description.match(/([\d.,]{2,})\s*km/i);
  if (!match) return 0;
  const digits = match[1].replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}


function titleFromDescription(description: string, fallback: string) {
  
  const firstSentence = description.split(/\.\s/)[0] || "";
  const cleaned = firstSentence.replace(/^\s*(19|20)\d{2}\s+model\s+/i, "").trim();
  return cleaned ? titleCase(cleaned) : titleCase(fallback);
}

interface RscVehicle {
  id?: string;
  slug?: string;
  name?: string;
  brand?: string;
  model?: string;
  year?: number;
  mileage?: number;
  pricePerDay?: number; 
  image?: string;
  images?: string[];
  description?: string;
  specs?: {
    transmission?: string;
    fuelType?: string;
    engineSize?: string;
    horsepower?: number;
  };
  dealerLocation?: string;
  tramerAmount?: number | null;
}


function extractRscVehicles(html: string): RscVehicle[] {
  const marker = '\\"vehicle\\":{';
  const vehicles: RscVehicle[] = [];
  let index = html.indexOf(marker);

  while (index !== -1) {
    const start = index + marker.length - 1; 
    let depth = 0;
    let end = -1;
    for (let i = start; i < html.length && i < start + 8000; i++) {
      if (html[i] === "{") depth += 1;
      else if (html[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) break;

    const raw = html.slice(start, end + 1).replace(/\\(["\\])/g, "$1");
    try {
      vehicles.push(JSON.parse(raw));
    } catch {
    
    }
    index = html.indexOf(marker, end);
  }

  return vehicles;
}


function resolvableCity(dealer: string): string {
  const cleaned = (dealer || "").trim();
  if (!cleaned || cleaned === "Merkez") return "İstanbul";
  const candidate = titleCase(cleaned);
  return cityToCoords(candidate) ? candidate : "İstanbul";
}

function rscVehicleToListing(vehicle: RscVehicle): ScrapedListing | null {
  if (!vehicle.slug || !vehicle.pricePerDay) return null;

  const description = vehicle.description || "";
  const dealer = vehicle.dealerLocation || "";
  const engineSize = parseFloat((vehicle.specs?.engineSize || "").replace(",", "."));

  return {
    externalId: vehicle.slug,
    sourceSite: "otomerkezi",
    listingUrl: `https://www.otomerkezi.net/ikinci-el/araba/${vehicle.slug}`,
    title: titleFromDescription(description, vehicle.name || vehicle.model || ""),
    brand: normalizeBrand(vehicle.brand || "Bilinmiyor"),
    model: titleCase(vehicle.model || "Model"),
    year: vehicle.year || new Date().getFullYear() - 3,
    price: vehicle.pricePerDay,
    mileage: vehicle.mileage ?? mileageFromDescription(description),
    
    city: resolvableCity(dealer),
    description,
    imageUrl: vehicle.image || vehicle.images?.[0] || "",
    images: (vehicle.images || []).filter(Boolean),
    damageFlag: Boolean(vehicle.tramerAmount),
    sellerType: "Galeriden",
    features: {
      fuelType: FUEL_MAP[(vehicle.specs?.fuelType || "").toLowerCase()] || "Bilinmiyor",
      transmission:
        TRANSMISSION_MAP[(vehicle.specs?.transmission || "").toLowerCase()] || "Bilinmiyor",
      bodyType: bodyTypeFromDescription(description) || "Belirtilmemiş",
      color: "Belirtilmemiş",
      engineSize: Number.isFinite(engineSize) && engineSize > 0 ? engineSize : undefined,
      horsepower: vehicle.specs?.horsepower || undefined,
    },
  };
}

export function parseOtomerkeziListHtml(html: string): ScrapedListing[] {

  const rscListings = extractRscVehicles(html)
    .map(rscVehicleToListing)
    .filter((listing): listing is ScrapedListing => listing !== null);
  if (rscListings.length > 0) return rscListings;

  return parseOtomerkeziLdJson(html);
}

function parseOtomerkeziLdJson(html: string): ScrapedListing[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  let items: { url?: string; item?: LdItem }[] = [];
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]);
      if (data["@type"] === "CollectionPage" && data.mainEntity?.itemListElement) {
        items = data.mainEntity.itemListElement;
        break;
      }
    } catch {
      continue;
    }
  }

  const listings: ScrapedListing[] = [];
  for (const entry of items) {
    const item = entry.item;
    const url = item?.url || entry.url;
    if (!item || !url || !item.offers?.price) continue;

    const slug = url.split("/").filter(Boolean).pop();
    if (!slug) continue;

    const rawBrand = item.brand?.name || "Bilinmiyor";
    const rawModel = item.model || "";
    const modelWithoutBrand = rawModel.startsWith(rawBrand)
      ? rawModel.slice(rawBrand.length).trim()
      : rawModel;
    const description = item.description || "";

    listings.push({
      externalId: slug,
      sourceSite: "otomerkezi",
      listingUrl: url,
      title: titleFromDescription(description, item.name || rawModel),
      brand: normalizeBrand(rawBrand),
      model: titleCase(modelWithoutBrand || rawModel || "Model"),
      year: Number(item.productionDate) || new Date().getFullYear() - 3,
      price: item.offers.price,
      mileage: mileageFromDescription(description),
      city: item.offers.seller?.address?.addressLocality || "Türkiye",
      description,
      imageUrl: item.image?.[0] || "",
      images: item.image?.filter(Boolean),
      damageFlag: false,
      sellerType: "Galeriden",
      features: {
        fuelType: FUEL_MAP[(item.fuelType || "").toLowerCase()] || "Bilinmiyor",
        transmission:
          TRANSMISSION_MAP[(item.vehicleTransmission || "").toLowerCase()] || "Bilinmiyor",
        bodyType: "Belirtilmemiş",
        color: "Belirtilmemiş",
      },
    });
  }

  return listings;
}

export async function scrapeOtomerkeziListings(
  limit: number,
  onListing: (listing: ScrapedListing) => Promise<void>
): Promise<number> {
  const pageCount = Math.min(Math.ceil(limit / ITEMS_PER_PAGE), MAX_PAGES);
  let fetched = 0;

  for (let page = 1; page <= pageCount; page++) {
    if (fetched >= limit) break;
    reportProgress("Otomerkezi sayfaları çekiliyor", page, pageCount);
    const url = page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`;
    const result = await fetchPageHtml(url);
    if (!result.ok) break;

    const pageListings = parseOtomerkeziListHtml(result.html);
    if (pageListings.length === 0) break;


    for (const listing of pageListings) {
      if (fetched >= limit) break;
      await onListing(listing);
      fetched += 1;
    }
  }

  if (fetched === 0) {
    throw new Error("Otomerkezi ilanları okunamadı. Site yapısı değişmiş olabilir.");
  }

  return fetched;
}
