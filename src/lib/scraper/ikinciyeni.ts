import { cityToCoords } from "@/lib/city-coords";
import { normalizeBrand, isNonCarBrand } from "@/lib/normalize-brand";
import { reportProgress } from "@/lib/scraper/progress";
import { ScrapedListing } from "@/lib/scraper/types";
import { Car } from "@/models/Car";

const IKINCIYENI_API_URL = "https://apigw.ikinciyeni.com";
const IKINCIYENI_BASE_URL = "https://www.ikinciyeni.com";

interface IkinciyeniVehicle {
  vehicleId?: string | number;
  brandName?: string;
  modelName?: string;
  versionName?: string;
  modelYear?: number;
  kilometer?: number;
  price?: number;
  buyNowPrice?: number;
  startingPrice?: number;
  cityName?: string;
  fuelType?: string;
  gearType?: string;
  imageUrl?: string;
  images?: string[];
  hasDamage?: boolean;
}

export async function scrapeIkinciyeniListings(
  limit: number,
  onListing: (listing: ScrapedListing) => Promise<void>,
  skipExisting = true
): Promise<number> {
  let fetched = 0;
  reportProgress("İkinciyeni.com araçları sorgulanıyor", 1, 2);

  // ListedVehicles returns the source records used below; the auction list
  // endpoint was an unused extra request, so skip it.
  const vehicleList: IkinciyeniVehicle[] = [];

  // Genel listeleme sorgusu
  try {
    const res = await fetch(`${IKINCIYENI_API_URL}/ListedVehicles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Origin: IKINCIYENI_BASE_URL,
        Referer: `${IKINCIYENI_BASE_URL}/araba-al`,
      },
      body: JSON.stringify({
        page: 1,
        pageSize: Math.min(limit, 50),
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const json = await res.json();
      const list = json?.data?.vehiclesList || json?.data?.fallBackList || [];
      if (Array.isArray(list)) {
        vehicleList.push(...list);
      }
    }
  } catch (err) {
    console.warn("[İkinciyeni] ListedVehicles hatası:", err instanceof Error ? err.message : err);
  }

  if (vehicleList.length === 0) {
    // İhale saatleri dışında veya açık ihale yokken
    return 0;
  }

  // 3. Adım: Varsa araçları işle ve aktar
  let itemsToProcess = vehicleList;

  if (skipExisting) {
    const externalIds = vehicleList
      .map((v) => (v.vehicleId ? `ikinciyeni-${v.vehicleId}` : null))
      .filter((id): id is string => !!id);

    if (externalIds.length > 0) {
      const existing = new Set(
        (
          await Car.find({ externalId: { $in: externalIds } }, { externalId: 1 }).lean<
            { externalId: string }[]
          >()
        ).map((d) => d.externalId)
      );

      itemsToProcess = itemsToProcess.filter((v) => {
        const id = v.vehicleId ? `ikinciyeni-${v.vehicleId}` : null;
        return !id || !existing.has(id);
      });
    }
  }

  for (const item of itemsToProcess) {
    if (fetched >= limit) break;

    const brand = normalizeBrand(item.brandName || "");
    if (!brand || isNonCarBrand(brand)) continue;

    const rawModel = (item.modelName || "").trim();
    const price = item.buyNowPrice || item.price || item.startingPrice || 0;
    if (price < 50000) continue;

    const year = Number(item.modelYear) || new Date().getFullYear();
    const mileage = Number(item.kilometer) || 0;
    const city = item.cityName || "İstanbul";
    const coords = cityToCoords(city);

    const externalId = `ikinciyeni-${item.vehicleId}`;
    const listingUrl = `${IKINCIYENI_BASE_URL}/araba-al/detay/${item.vehicleId}`;

    const title = `${brand} ${rawModel} ${item.versionName || ""} ${year} ${mileage.toLocaleString("tr-TR")} km`.trim();
    const mainImage = item.imageUrl || item.images?.[0] || "";
    if (!mainImage) continue;

    const description = `${title} - İkinciyeni.com Çelik Motor Kurumsal Ekspertizli 2. El. ${city} merkezli, ${item.gearType || "Bilinmiyor"} vites, ${item.fuelType || "Bilinmiyor"} yakıt.`;

    const listing: ScrapedListing = {
      externalId,
      sourceSite: "ikinciyeni",
      listingUrl,
      title,
      brand,
      model: rawModel,
      year,
      price,
      mileage,
      city,
      address: `${city} İkinciyeni Teslimat Merkezi`,
      description,
      imageUrl: mainImage,
      images: item.images && item.images.length > 0 ? item.images : [mainImage],
      damageFlag: Boolean(item.hasDamage),
      sellerType: "Kurumsal",
      location: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
      features: {
        fuelType: item.fuelType || "Bilinmiyor",
        transmission: item.gearType || "Bilinmiyor",
        bodyType: "Belirtilmemiş",
        color: "Belirtilmemiş",
      },
    };

    await onListing(listing);
    fetched += 1;
  }

  return fetched;
}
