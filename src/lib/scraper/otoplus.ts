import { cityToCoords } from "@/lib/city-coords";
import { normalizeBrand, isNonCarBrand } from "@/lib/normalize-brand";
import { reportProgress } from "@/lib/scraper/progress";
import { CrawlReport, ScrapedListing } from "@/lib/scraper/types";
import { Car } from "@/models/Car";

const BASE_URL = "https://www.otoplus.com/ikinci-el-araba";
const ITEMS_PER_PAGE = 12;

const TRANSMISSION_MAP: Record<string, string> = {
  automatic: "Otomatik",
  manual: "Manuel",
  "semi-automatic": "Yarı Otomatik",
  otomatik: "Otomatik",
  manuel: "Manuel",
};

const FUEL_MAP: Record<string, string> = {
  benzin: "Benzin",
  gasoline: "Benzin",
  petrol: "Benzin",
  dizel: "Dizel",
  diesel: "Dizel",
  hibrit: "Hibrit",
  hybrid: "Hibrit",
  elektrik: "Elektrik",
  electric: "Elektrik",
  lpg: "LPG",
};

function extractCityFromUrl(url: string): string | null {
  // e.g. -ekspertizli-İzmir-1300000tl-572344
  const match = url.match(/-([A-Za-zÇĞİÖŞÜçğıöşü]+)-\d+tl-\d+/i);
  if (match) {
    const candidate = match[1];
    if (candidate.length > 2 && candidate.toLowerCase() !== "ekspertizli") {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
    }
  }
  return null;
}

export async function scrapeOtoplusListings(
  limit: number,
  onListing: (listing: ScrapedListing) => Promise<void>,
  skipExisting = true,
  pageOffset = 1,
  report?: CrawlReport
): Promise<number> {
  let fetched = 0;
  let pageNum = Math.max(1, pageOffset);
  const maxPagesToScan = Math.min(Math.ceil(limit / ITEMS_PER_PAGE) + 6, 80);
  const maxPage = pageNum + maxPagesToScan;
  // Otoplus son sayfanın ötesinde 404 döner (ölçüldü: ?sayfa=15 → 404).
  const endOfList = () => {
    if (!report) return;
    if (pageNum > 1) report.endedNaturally = true;
    else report.error = "İlk sayfada araç bulunamadı (site yapısı değişmiş olabilir).";
  };

  while (fetched < limit && pageNum <= maxPage) {
    reportProgress(`Otoplus araçları taranıyor (Sf.${pageNum})`, pageNum, maxPage);

    let html = "";
    try {
      const res = await fetch(`${BASE_URL}?sayfa=${pageNum}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 404) {
        endOfList();
        break;
      }
      if (!res.ok) {
        if (report) report.error = `HTTP ${res.status} (Sf.${pageNum})`;
        break;
      }
      html = await res.text();
    } catch (err) {
      if (report) report.error = err instanceof Error ? err.message : "istek hatası";
      break;
    }
    if (report) report.pages += 1;

    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (!match) {
      endOfList();
      break;
    }

    let vehicles: any[] = [];
    try {
      const json = JSON.parse(match[1]);
      vehicles = (json["@graph"] || []).filter(
        (item: any) => item["@type"] === "Vehicle" || item["@type"] === "Car"
      );
    } catch {
      if (report) report.error = `Sf.${pageNum} ld+json okunamadı`;
      break;
    }

    if (vehicles.length === 0) {
      endOfList();
      break;
    }

    let itemsToProcess = vehicles;

    if (skipExisting) {
      const externalIds = itemsToProcess
        .map((v) => {
          const idMatch = (v.url || "").match(/(\d+)$/);
          return idMatch ? `otoplus-${idMatch[1]}` : null;
        })
        .filter((id): id is string => !!id);

      if (externalIds.length > 0) {
        const existing = new Set(
          (
            await Car.find(
              { externalId: { $in: externalIds }, sourceSite: "otoplus" },
              { externalId: 1 }
            ).lean()
          ).map((c: any) => c.externalId)
        );

        itemsToProcess = itemsToProcess.filter((v) => {
          const idMatch = (v.url || "").match(/(\d+)$/);
          return !idMatch || !existing.has(`otoplus-${idMatch[1]}`);
        });
      }
    }

    for (const v of itemsToProcess) {
      if (fetched >= limit) break;

      const idMatch = (v.url || "").match(/(\d+)$/);
      // Kimliksiz kayıt her taramada yeni bir ilan gibi eklenirdi (Date.now() kimliği) → atla.
      if (!idMatch) {
        if (report) report.unsafeOmissions = (report.unsafeOmissions || 0) + 1;
        continue;
      }
      const extId = `otoplus-${idMatch[1]}`;
      report?.observedIds?.add(extId);
      const rawBrand = v.brand?.name || v.manufacturer?.name || "";
      const brand = normalizeBrand(rawBrand);
      if (!brand || isNonCarBrand(brand)) continue;

      const title = v.name || `${brand} İkinci El`;
      const price = Number(v.offers?.price) || 0;
      if (price <= 0) continue;

      const year = Number(v.vehicleModelDate || v.productionDate) || new Date().getFullYear();
      const mileage = Number(v.mileageFromOdometer?.value) || 0;
      const rawCity = extractCityFromUrl(v.url || "");
      const city = rawCity || "Türkiye";
      const cityVerified = Boolean(rawCity && cityToCoords(rawCity));

      // Kaynakta yazmayan özellik tahmin edilmez; kasa tipi başlıktan değil ilan sayfasından (enrich-detail) gelir.
      const rawTrans = (v.vehicleTransmission || "").toLowerCase();
      const transmission = TRANSMISSION_MAP[rawTrans] || "Bilinmiyor";

      const rawFuel = (v.vehicleEngine?.fuelType || "").toLowerCase();
      const fuelType = FUEL_MAP[rawFuel] || "Bilinmiyor";

      const bodyType = "Belirtilmemiş";
      const imageUrl = v.image || "";

      // Model name extraction
      const parts = title.replace(new RegExp(`^${year}\\s+`, "i"), "").split(" ");
      const model = parts.length > 1 ? parts[1] : brand;

      const listing: ScrapedListing = {
        externalId: extId,
        sourceSite: "otoplus",
        listingUrl: v.url || BASE_URL,
        title,
        brand,
        model,
        year,
        yearVerified: Number(v.vehicleModelDate || v.productionDate) > 0,
        price,
        mileage,
        city,
        cityVerified,
        description: v.description || title,
        imageUrl,
        images: imageUrl ? [imageUrl] : [],
        features: {
          fuelType,
          transmission,
          bodyType,
          color: "Belirtilmemiş",
        },
      };

      await onListing(listing);
      fetched++;
    }

    // Tam envanter taramasında siteyi yormamak için sayfalar arası bekleme.
    if (report) await new Promise((r) => setTimeout(r, 1000));
    pageNum++;
  }

  return fetched;
}
