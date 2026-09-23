import { cityToCoords } from "@/lib/city-coords";
import { normalizeBrand, isNonCarBrand } from "@/lib/normalize-brand";
import { reportProgress } from "@/lib/scraper/progress";
import { ScrapedListing } from "@/lib/scraper/types";
import { Car } from "@/models/Car";

const SEARCH_API_URL = "https://app-vava-dtc-search-tr-prod.vava.cars/search";
const PAGE_SIZE = 20;

interface VavaCarItem {
  id?: string;
  vehiclePurchaseId?: number;
  make?: string;
  model?: string;
  trimLevel?: string;
  year?: number;
  price?: number;
  mileage?: number;
  locationCity?: string;
  transmission?: string;
  fuelType?: string;
  isDamaged?: boolean;
  hasTramer?: boolean;
  imageUrl?: string;
  images?: Array<{ url?: string; type?: string }>;
  categories?: string[];
}

interface VavaSearchResponse {
  items?: VavaCarItem[];
  totalCount?: number;
}

export async function scrapeVavaCarsListings(
  limit: number,
  onListing: (listing: ScrapedListing) => Promise<void>,
  skipExisting = true,
  pageOffset = 1
): Promise<number> {
  let fetched = 0;
  let pageNum = Math.max(1, pageOffset);
  const maxPagesToScan = Math.ceil(limit / PAGE_SIZE) + 6;
  const maxPage = pageNum + maxPagesToScan;

  while (fetched < limit && pageNum <= maxPage) {
    reportProgress(`VavaCars araçları çekiliyor (Sf.${pageNum})`, pageNum, maxPage);

    let data: VavaSearchResponse | null = null;
    try {
      const res = await fetch(SEARCH_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://tr.vava.cars",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          pageNum,
          pageSize: PAGE_SIZE,
          filters: {},
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) break;
      data = await res.json();
    } catch {
      break;
    }

    if (!data?.items || data.items.length === 0) break;

    let itemsToProcess = data.items;

    if (skipExisting) {
      const externalIds = itemsToProcess
        .map((it) => (it.vehiclePurchaseId ? `vavacars-${it.vehiclePurchaseId}` : null))
        .filter((id): id is string => !!id);

      if (externalIds.length > 0) {
        const existing = new Set(
          (
            await Car.find({ externalId: { $in: externalIds } }, { externalId: 1 }).lean<
              { externalId: string }[]
            >()
          ).map((d) => d.externalId)
        );

        itemsToProcess = itemsToProcess.filter((it) => {
          const id = it.vehiclePurchaseId ? `vavacars-${it.vehiclePurchaseId}` : null;
          return !id || !existing.has(id);
        });
      }
    }

    for (const item of itemsToProcess) {
      if (fetched >= limit) break;

      const rawBrand = (item.make || "").trim();
      const rawModel = (item.model || "").trim();
      const brand = normalizeBrand(rawBrand);
      if (!brand || isNonCarBrand(brand)) continue;

      const price = Number(item.price) || 0;
      if (price < 50000) continue; // Mantıksız veya sıfır fiyatları ele

      const purchaseId = item.vehiclePurchaseId;
      const externalId = purchaseId ? `vavacars-${purchaseId}` : `vavacars-${item.id}`;
      const slugBrand = rawBrand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const slugModel = rawModel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const listingUrl = purchaseId
        ? `https://www.vava.cars/tr/buy-cars/${slugBrand}/${slugModel}/${purchaseId}`
        : "https://www.vava.cars/tr/buy-cars";

      const year = Number(item.year) || new Date().getFullYear();
      const mileage = Number(item.mileage) || 0;
      const city = item.locationCity?.trim() || "İstanbul";
      const coords = cityToCoords(city);

      const title = `${rawBrand} ${rawModel} ${item.trimLevel || ""} ${year} ${mileage.toLocaleString("tr-TR")} km`.trim();

      const imageList = (item.images || [])
        .map((img) => img.url)
        .filter((url): url is string => !!url && /^https?:\/\//.test(url));

      const mainImage = item.imageUrl || imageList[0] || "";
      if (!mainImage) continue; // Görseli olmayan araçları atla

      const description = `${title} - VavaCars Ekspertiz Onaylı Kurumsal İkinci El. ${city} merkezli, ${item.transmission || "Bilinmiyor"} vites, ${item.fuelType || "Bilinmiyor"} yakıt.`;

      const listing: ScrapedListing = {
        externalId,
        sourceSite: "vavacars",
        listingUrl,
        title,
        brand,
        model: rawModel,
        year,
        price,
        mileage,
        city,
        address: `${city} VavaCars Merkezi`,
        description,
        imageUrl: mainImage,
        images: imageList.length > 0 ? imageList : [mainImage],
        damageFlag: Boolean(item.isDamaged || item.hasTramer),
        sellerType: "Galeriden",
        location: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
        features: {
          fuelType: item.fuelType || "Bilinmiyor",
          transmission: item.transmission || "Bilinmiyor",
          bodyType: item.categories?.[0] || "Belirtilmemiş",
          color: "Belirtilmemiş",
        },
      };

      await onListing(listing);
      fetched += 1;
    }

    pageNum += 1;
  }

  return fetched;
}
