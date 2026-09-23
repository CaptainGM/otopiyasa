import * as cheerio from "cheerio";
import { cityToCoords } from "@/lib/city-coords";
import { normalizeBrand, isNonCarBrand } from "@/lib/normalize-brand";
import { reportProgress } from "@/lib/scraper/progress";
import { ScrapedListing } from "@/lib/scraper/types";
import { Car } from "@/models/Car";

const OTOKOC_BASE_URL = "https://www.otokocikinciel.com";
const PAGE_SIZE = 15;

export async function scrapeOtokocListings(
  limit: number,
  onListing: (listing: ScrapedListing) => Promise<void>,
  skipExisting = true,
  pageOffset = 1
): Promise<number> {
  let fetched = 0;
  let pageNum = Math.max(1, pageOffset);
  const maxPagesToScan = Math.ceil(limit / PAGE_SIZE) + 8;
  const maxPage = pageNum + maxPagesToScan;

  while (fetched < limit && pageNum <= maxPage) {
    reportProgress(`Otokoç 2. El araçları çekiliyor (Sf.${pageNum})`, pageNum, maxPage);

    let html = "";
    try {
      const res = await fetch(`${OTOKOC_BASE_URL}/ikinci-el?page=${pageNum}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) break;
      html = await res.text();
    } catch {
      break;
    }

    if (!html || !html.includes("product-card")) break;

    const $ = cheerio.load(html);
    const articles = $("article[data-testid='product-card']");
    if (articles.length === 0) break;

    const rawItems: Array<{
      id: string;
      make: string;
      model: string;
      year: number;
      price: number;
      mileage: number;
      fuel: string;
      transmission: string;
      color: string;
      city: string;
      href: string;
      imgSrc: string;
      alt: string;
    }> = [];

    articles.each((_, el) => {
      const $el = $(el);
      const id = $el.attr("data-id") || "";
      if (!id) return;

      const make = $el.attr("data-make") || "";
      const model = $el.attr("data-model") || "";
      const year = Number($el.attr("data-year")) || new Date().getFullYear();
      const price = Number($el.attr("data-price")) || 0;
      const mileage = Number($el.attr("data-mileage")) || 0;
      const fuel = $el.attr("data-fuel") || "Bilinmiyor";
      const transmission = $el.attr("data-transmission") || "Bilinmiyor";
      const color = $el.attr("data-color") || "Belirtilmemiş";
      const city = $el.attr("data-city") || "İstanbul";

      const parentA = $el.closest("a");
      const href = parentA.attr("href") || "";

      // Doğru görsel seçimi: noscript içi yüksek çözünürlüklü webp veya normal img
      let imgSrc = "";
      const artHtml = $el.html() || "";
      const match450 = artHtml.match(/https:\/\/2el-cdn\.otokoc\.com\.tr\/otokoc2el\/car\/(?:450x|640x)\/[a-zA-Z0-9_-]+\.webp/i);
      const matchAny = artHtml.match(/https:\/\/2el-cdn\.otokoc\.com\.tr\/otokoc2el\/car\/(?:335x|220x)\/[a-zA-Z0-9_-]+\.webp/i);
      if (match450) {
        imgSrc = match450[0];
      } else if (matchAny) {
        imgSrc = matchAny[0];
      } else {
        const cardImg = $el.find('img[data-testid="listing-card-image"]').first();
        if (cardImg.length > 0) {
          imgSrc = cardImg.attr("src") || cardImg.attr("data-src") || "";
        }
        if (!imgSrc) {
          const sourceEl = $el.find("picture source").first();
          const srcSet = sourceEl.attr("srcset") || sourceEl.attr("srcSet") || "";
          if (srcSet) {
            const parts = srcSet.split(",");
            const lastPart = parts[parts.length - 1]?.trim().split(" ")[0];
            if (lastPart && /^https?:\/\//.test(lastPart)) {
              imgSrc = lastPart;
            }
          }
        }
        if (!imgSrc) {
          $el.find("img").each((_, im) => {
            const s = $(im).attr("src") || "";
            if (s && !s.includes(".svg") && !s.includes("badge") && !s.includes("logo")) {
              imgSrc = s;
              return false;
            }
          });
        }
      }

      const alt = `${make} ${model}`;

      rawItems.push({
        id,
        make,
        model,
        year,
        price,
        mileage,
        fuel,
        transmission,
        color,
        city,
        href,
        imgSrc,
        alt,
      });
    });

    let itemsToProcess = rawItems;

    if (skipExisting) {
      const externalIds = rawItems.map((it) => `otokoc-${it.id}`);
      if (externalIds.length > 0) {
        const existing = new Set(
          (
            await Car.find({ externalId: { $in: externalIds } }, { externalId: 1 }).lean<
              { externalId: string }[]
            >()
          ).map((d) => d.externalId)
        );

        itemsToProcess = itemsToProcess.filter((it) => !existing.has(`otokoc-${it.id}`));
      }
    }

    for (const item of itemsToProcess) {
      if (fetched >= limit) break;

      const brand = normalizeBrand(item.make);
      if (!brand || isNonCarBrand(brand)) continue;

      if (item.price < 50000) continue;

      const externalId = `otokoc-${item.id}`;
      const listingUrl = item.href.startsWith("http")
        ? item.href
        : `${OTOKOC_BASE_URL}${item.href}`;

      // Şehir adını formatla
      const cityName =
        item.city.charAt(0).toLocaleUpperCase("tr-TR") + item.city.slice(1).toLocaleLowerCase("tr-TR");
      const coords = cityToCoords(cityName);

      // Yakıt ve vites formatla
      const fuelType =
        item.fuel.charAt(0).toLocaleUpperCase("tr-TR") + item.fuel.slice(1);
      const transmissionType =
        item.transmission.charAt(0).toLocaleUpperCase("tr-TR") + item.transmission.slice(1);

      const title = `${brand} ${item.model.toUpperCase()} ${item.year} ${item.mileage.toLocaleString("tr-TR")} km`.trim();
      const mainImage = item.imgSrc.startsWith("http")
        ? item.imgSrc
        : item.imgSrc ? `${OTOKOC_BASE_URL}${item.imgSrc}` : "";

      if (!mainImage) continue;

      const description = `${title} - Otokoç 2. El Koç Grubu Kurumsal Garantili İkinci El. ${cityName} şubesi, ${transmissionType} vites, ${fuelType} yakıt.`;

      const listing: ScrapedListing = {
        externalId,
        sourceSite: "otokoc",
        listingUrl,
        title,
        brand,
        model: item.model.toUpperCase(),
        year: item.year,
        price: item.price,
        mileage: item.mileage,
        city: cityName,
        address: `${cityName} Otokoç 2. El Şubesi`,
        description,
        imageUrl: mainImage,
        images: [mainImage],
        damageFlag: false,
        sellerType: "Kurumsal",
        location: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
        features: {
          fuelType,
          transmission: transmissionType,
          bodyType: "Belirtilmemiş",
          color: item.color,
        },
      };

      await onListing(listing);
      fetched += 1;
    }

    pageNum += 1;
  }

  return fetched;
}
