import { cityToCoords } from "@/lib/city-coords";
import { normalizeBrand, isNonCarBrand } from "@/lib/normalize-brand";
import { reportProgress } from "@/lib/scraper/progress";
import { CrawlReport, ScrapedListing } from "@/lib/scraper/types";
import { Car } from "@/models/Car";

const SEARCH_API_URL = "https://app-vava-dtc-search-tr-prod.vava.cars/search";
const PAGE_SIZE = 20;
const SITE_URL = "https://tr.vava.cars";

/**
 * VavaCars ilan adresi. Site www.vava.cars/tr/buy-cars/... adreslerini artık
 * ana sayfaya yönlendiriyor; güncel rota (sitenin kendi Angular yönlendiricisi)
 * `/buy/cars/:make/:model/:id` ve `id` aracın UUID'si (vehiclePurchaseId değil).
 */
export function vavaListingUrl(item: { id?: string; make?: string; model?: string }): string {
  if (!item.id) return `${SITE_URL}/buy/cars`;
  const make = encodeURIComponent((item.make || "").trim() || "arac");
  const model = encodeURIComponent((item.model || "").trim() || "model");
  return `${SITE_URL}/buy/cars/${make}/${model}/${item.id}`;
}

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
  pageOffset = 1,
  report?: CrawlReport
): Promise<number> {
  let fetched = 0;
  let pageNum = Math.max(1, pageOffset);
  const maxPagesToScan = Math.min(Math.ceil(limit / PAGE_SIZE) + 6, 60);
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

      if (!res.ok) {
        if (report) report.error = `HTTP ${res.status} (Sf.${pageNum})`;
        break;
      }
      data = await res.json();
    } catch (err) {
      if (report) report.error = err instanceof Error ? err.message : "istek hatası";
      break;
    }

    if (report) {
      report.pages += 1;
      if (typeof data?.totalCount === "number") report.expectedTotal = data.totalCount;
    }
    if (!data?.items || data.items.length === 0) {
      if (report) report.endedNaturally = true;
      break;
    }
    const isLastPage = data.items.length < PAGE_SIZE;

    let itemsToProcess = data.items;

    if (skipExisting) {
      const externalIds = itemsToProcess
        .flatMap((it) => [it.id, it.vehiclePurchaseId?.toString()].filter((id): id is string => !!id).map((id) => `vavacars-${id}`));

      if (externalIds.length > 0) {
        const existing = new Set(
          (
            await Car.find({ externalId: { $in: externalIds } }, { externalId: 1 }).lean<
              { externalId: string }[]
            >()
          ).map((d) => d.externalId)
        );

        itemsToProcess = itemsToProcess.filter((it) => {
          const ids = [it.id, it.vehiclePurchaseId?.toString()].filter((id): id is string => !!id).map((id) => `vavacars-${id}`);
          return !ids.some((id) => existing.has(id));
        });
      }
    }

    for (const item of itemsToProcess) {
      if (fetched >= limit) break;

      const purchaseId = item.vehiclePurchaseId;
      const externalId = item.id ? `vavacars-${item.id}` : purchaseId ? `vavacars-${purchaseId}` : "";
      const identityAliases = purchaseId && externalId !== `vavacars-${purchaseId}` ? [`vavacars-${purchaseId}`] : undefined;
      if (!externalId) {
        if (report) report.unsafeOmissions = (report.unsafeOmissions || 0) + 1;
        continue;
      }
      report?.observedIds?.add(externalId);
      identityAliases?.forEach((id) => report?.observedIds?.add(id));
      const rawBrand = (item.make || "").trim();
      const rawModel = (item.model || "").trim();
      const brand = normalizeBrand(rawBrand);
      if (!brand || isNonCarBrand(brand)) continue;

      const price = Number(item.price) || 0;
      if (price < 50000) continue; // Mantıksız veya sıfır fiyatları ele

      const listingUrl = vavaListingUrl(item);

      const year = Number(item.year) || new Date().getFullYear();
      const mileage = Number(item.mileage) || 0;
      const rawCity = item.locationCity?.trim() || "";
      const cityVerified = Boolean(rawCity && cityToCoords(rawCity));
      const city = cityVerified ? rawCity : "Türkiye";

      const title = `${rawBrand} ${rawModel} ${item.trimLevel || ""} ${year} ${mileage.toLocaleString("tr-TR")} km`.trim();

      const imageList = (item.images || [])
        .map((img) => img.url)
        .filter((url): url is string => !!url && /^https?:\/\//.test(url));

      const mainImage = item.imageUrl || imageList[0] || "";
      if (!mainImage) continue; // Görseli olmayan araçları atla

      const cityText = cityVerified ? ` ${city} merkezli,` : "";
      const description = `${title} - VavaCars Ekspertiz Onaylı Kurumsal İkinci El.${cityText} ${item.transmission || "Bilinmiyor"} vites, ${item.fuelType || "Bilinmiyor"} yakıt.`;

      const listing: ScrapedListing = {
        externalId,
        identityAliases,
        sourceSite: "vavacars",
        listingUrl,
        title,
        brand,
        model: rawModel,
        year,
        yearVerified: Number(item.year) > 0,
        price,
        mileage,
        city,
        cityVerified,
        address: cityVerified ? `${city} VavaCars Merkezi` : undefined,
        description,
        imageUrl: mainImage,
        images: imageList.length > 0 ? imageList : [mainImage],
        damageFlag: Boolean(item.isDamaged || item.hasTramer),
        sellerType: "Galeriden",
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

    if (isLastPage) {
      if (report) report.endedNaturally = true;
      break;
    }
    // Tam envanter taramasında siteyi yormamak için sayfalar arası bekleme.
    if (report) await new Promise((r) => setTimeout(r, 1000));
    pageNum += 1;
  }

  return fetched;
}
