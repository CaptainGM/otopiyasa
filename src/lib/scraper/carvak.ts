import { extractImageUrl } from "@/lib/car-images";
import { cityToCoords } from "@/lib/city-coords";
import { normalizeBrand, isNonCarBrand } from "@/lib/normalize-brand";
import { reportProgress } from "@/lib/scraper/progress";
import { CrawlReport, ScrapedListing } from "@/lib/scraper/types";
import { Car } from "@/models/Car";

const CARVAK_URL = "https://www.carvak.com/tr/satilik-arac";

export async function scrapeCarvakListings(
  limit: number,
  onListing: (listing: ScrapedListing) => Promise<void>,
  skipExisting = true,
  pageOffset = 1,
  report?: CrawlReport
): Promise<number> {
  let fetched = 0;
  let page = Math.max(1, pageOffset);
  // Envanter ~105 araç / sayfa başı ~30 (2026-09); tam tarama için tavan 20 sayfa.
  const maxPages = Math.min(20, page + Math.ceil(limit / 30));

  while (fetched < limit && page <= maxPages) {
    reportProgress(`Carvak araçları taranıyor (Sf.${page})`, page, maxPages);

    const url = page === 1 ? CARVAK_URL : `${CARVAK_URL}?page=${page}`;
    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        if (report) report.error = `HTTP ${res.status} (Sf.${page})`;
        break;
      }
      html = await res.text();
    } catch (err) {
      if (report) report.error = err instanceof Error ? err.message : "istek hatası";
      break;
    }
    if (report) report.pages += 1;

    // Carvak Angular Universal state transfer verisini yakala
    const match = html.match(/<script\b[^>]*id="serverApp-state"[^>]*>([\s\S]*?)<\/script>/i);
    let cars: any[] = [];
    // Durum verisi okunduysa (liste boş olsa bile) ona güvenilir: son sayfanın ötesinde
    // liste gerçekten boştur. Eskiden boş listede yedek ayrıştırıcıya düşülüyor ve
    // sayfa başına uydurma tek bir araç DB'ye ilan olarak yazılıyordu.
    let stateParsed = false;

    if (match) {
      try {
        const rawJson = match[1].replace(/&q;/g, '"');
        const data = JSON.parse(rawJson);
        const grid = data?.["engine-main-state"]?.grid;
        if (Array.isArray(grid?.cars)) {
          cars = grid.cars;
          stateParsed = true;
        }
      } catch (err) {
        console.warn("Carvak state parse hatası:", err);
      }
    }

    // Fallback: Eski schema formatı (yalnızca durum verisi hiç okunamadıysa)
    if (!stateParsed && cars.length === 0) {
      const scriptMatch = html.match(/<script\b[^>]*>([\s\S]*?"@graph"\s*:\s*\[[\s\S]*?)<\/script>/i);
      if (scriptMatch) {
        try {
          const parsed = JSON.parse(scriptMatch[1]);
          const graphCars = parsed["@graph"]?.[0]?.mainEntity?.offers?.["@graph"]?.itemListElement || [];
          cars = graphCars.map((it: any) => it.item).filter(Boolean);
        } catch {}
      }
    }

    if (cars.length === 0) {
      // Son sayfanın ötesinde liste boş gelir (ölçüldü: ?page=6 → 0 araç).
      if (report) {
        if (page > 1) report.endedNaturally = true;
        else report.error = "İlk sayfada araç bulunamadı (site yapısı değişmiş olabilir).";
      }
      break;
    }

    let itemsToProcess = cars;

    if (skipExisting) {
      const externalIds = itemsToProcess
        .map((c: any) => (c.id ? `carvak-${c.id}` : c.sku ? `carvak-${c.sku}` : null))
        .filter((id): id is string => !!id);

      if (externalIds.length > 0) {
        const existing = new Set(
          (
            await Car.find(
              { externalId: { $in: externalIds }, sourceSite: "carvak" },
              { externalId: 1 }
            ).lean()
          ).map((c: any) => c.externalId)
        );

        itemsToProcess = itemsToProcess.filter((c: any) => {
          const id = c.id ? `carvak-${c.id}` : c.sku ? `carvak-${c.sku}` : null;
          return !id || !existing.has(id);
        });
      }
    }

    for (const car of itemsToProcess) {
      if (fetched >= limit) break;

      const carId = car.id || car.sku;
      // Kimliksiz kayıt her taramada yeni ilan gibi eklenirdi → atla.
      if (!carId) {
        if (report) report.unsafeOmissions = (report.unsafeOmissions || 0) + 1;
        continue;
      }
      const extId = `carvak-${carId}`;
      report?.observedIds?.add(extId);
      const rawBrand = (car.make || car.brand?.name || "").trim();
      const rawModel = (car.model || "").trim();
      const brand = normalizeBrand(rawBrand);
      if (!brand || brand === "Bilinmiyor" || isNonCarBrand(brand)) continue;

      const title = (car.name || `${brand} ${rawModel} ${car.trim || ""}`).trim();
      let price = 0;
      if (typeof car.price === "number") {
        price = car.price;
      } else if (typeof car.price === "string") {
        price = Number(car.price.replace(/[^0-9]/g, "")) || 0;
      } else if (car.offers?.price) {
        price = Number(car.offers.price) || 0;
      }
      if (price < 50000) continue;

      const year = Number(car.year || car.vehicleModelDate) || new Date().getFullYear();
      const mileage = Number(car.kmNoFormat || car.mileageFromOdometer?.value) || 0;
      const city = car.regionName || "İstanbul";
      const coords = cityToCoords(city);

      // Kaynakta yazmayan özellik tahmin edilmez ("Otomatik"/"Benzin" varsayılanı yanlış veri üretiyordu);
      // ilan sayfası okununca (enrich-detail) gerçek değer gelir.
      const fuelType = car.fuelType || car.vehicleEngine?.fuelType || "Bilinmiyor";
      const transmission = car.transmission || car.vehicleTransmission || "Bilinmiyor";
      const bodyType = car.bodyType || "Belirtilmemiş";
      const color = car.color || "Belirtilmemiş";

      const mainImage = extractImageUrl(car.imageUrl || car.image || car.images || car.photos || car.gallery);
      const images: string[] = mainImage ? [mainImage] : [];

      const listingUrl = car.url || car.offers?.url || CARVAK_URL;
      const gearText = transmission !== "Bilinmiyor" ? ` ${transmission} vites,` : "";
      const description = `${title} - Carvak Garantili İkinci El. ${city} merkezli,${gearText} ${mileage.toLocaleString("tr-TR")} km.`;

      const listing: ScrapedListing = {
        externalId: extId,
        sourceSite: "carvak",
        listingUrl,
        title,
        brand,
        model: rawModel || brand,
        year,
        yearVerified: Number(car.year || car.vehicleModelDate) > 0,
        price,
        mileage,
        city,
        address: `${city} Carvak Merkezi`,
        description,
        imageUrl: mainImage,
        images: images.length > 0 ? images : undefined,
        location: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
        sellerType: "Galeriden",
        features: {
          fuelType,
          transmission,
          bodyType,
          color,
        },
      };

      await onListing(listing);
      fetched++;
    }

    // Tam envanter taramasında siteyi yormamak için sayfalar arası bekleme.
    if (report) await new Promise((r) => setTimeout(r, 1000));
    page++;
  }

  return fetched;
}
