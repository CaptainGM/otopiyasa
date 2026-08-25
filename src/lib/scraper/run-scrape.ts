import mongoose from "mongoose";
import { Car } from "@/models/Car";
import {
  arabamAdapter,
  demoImportAdapter,
  otomerkeziAdapter,
  sahibindenAdapter,
  scrapeArabamForBrands,
  scrapeArabamForModels,
  refetchArabamDetails,
  POPULAR_BRANDS,
} from "@/lib/scraper/adapters";
import { normalizeBrand } from "@/lib/normalize-brand";
import { notifyFavoritePriceDrop } from "@/lib/price-alerts";
import { checkSubscriptions } from "@/lib/subscriptions";
import { ScrapeAdapter, ScrapeJobResult, ScrapedListing } from "@/lib/scraper/types";
import { ListingSource } from "@/types";

function pickAdapters(source: "sahibinden" | "arabam" | "otomerkezi" | "all"): ScrapeAdapter[] {
  if (source === "sahibinden") return [sahibindenAdapter];
  if (source === "arabam") return [arabamAdapter];
  if (source === "otomerkezi") return [otomerkeziAdapter];

  return [arabamAdapter, otomerkeziAdapter];
}


function hasImages(listing: ScrapedListing): boolean {
  return Array.isArray(listing.images) && listing.images.length > 0;
}

async function saveListing(listing: ScrapedListing) {
  const existing = await Car.findOne({
    sourceSite: listing.sourceSite,
    externalId: listing.externalId,
  });

  if (existing) {
    const oldPrice = existing.price;

    const newPrice = listing.price > 0 ? listing.price : existing.price;
    const priceChanged = existing.price !== newPrice;

    existing.title = listing.title || existing.title;
    existing.brand = listing.brand || existing.brand;
    existing.model = listing.model || existing.model;
    if (listing.year > 0) existing.year = listing.year;
    existing.price = newPrice;
    if (listing.mileage > 0) existing.mileage = listing.mileage;
    existing.city = listing.city || existing.city;
    if (listing.address) existing.address = listing.address;
    existing.description = listing.description || existing.description;

    if (hasImages(listing)) {
      existing.images = listing.images as string[];
      existing.imageUrl = listing.imageUrl || (listing.images as string[])[0];
    }
    existing.damageFlag = listing.damageFlag || false;

    if (listing.damageParts && listing.damageParts.length > 0) {
      existing.damageParts = listing.damageParts;
    }
    if (listing.location) existing.location = listing.location;
    if (listing.features) existing.features = listing.features;
    existing.listingUrl = listing.listingUrl || existing.listingUrl;
    existing.source = listing.sourceSite;

    if (priceChanged) {
      existing.priceHistory.push({
        price: newPrice,
        recordedAt: new Date(),
      });
    }

    await existing.save();


    if (priceChanged && newPrice < oldPrice) {
      try {
        await notifyFavoritePriceDrop(existing, oldPrice);
      } catch (error) {
        console.error("Fiyat düşüşü bildirimi başarısız:", error);
      }
    }

    return "updated" as const;
  }


  if (!(listing.price > 0)) {
    return "skipped" as const;
  }

  await Car.create({
    ...listing,
    source: listing.sourceSite,
    priceHistory: [{ price: listing.price, recordedAt: new Date() }],
  });
  return "inserted" as const;
}

export async function runScrapeJob(options: {
  source: "sahibinden" | "arabam" | "otomerkezi" | "all" | "demo";
  query: string;
  limit?: number;
}): Promise<ScrapeJobResult> {
  const adapters =
    options.source === "demo"
      ? [demoImportAdapter]
      : pickAdapters(options.source);

  let inserted = 0;
  let updated = 0;
  const sources: ScrapeJobResult["sources"] = [];
  const errors: string[] = [];

  for (const adapter of adapters) {
    let saved = 0;


    const onListing = async (listing: ScrapedListing) => {
      const result = await saveListing(listing);
      if (result === "inserted") inserted += 1;
      if (result === "updated") updated += 1;
      if (result !== "skipped") saved += 1;
    };

    try {
      const { fetched } = await adapter.scrape(
        options.query,
        options.limit || 12,
        onListing
      );
      sources.push({ source: adapter.id as ListingSource, fetched, saved });
    } catch (error) {
      errors.push(
        `${adapter.label}: ${
          error instanceof Error ? error.message : "bilinmeyen hata"
        }`
      );

      if (saved > 0) {
        sources.push({ source: adapter.id as ListingSource, fetched: saved, saved });
      }
    }
  }

  if (sources.length === 0 && errors.length > 0) {
    throw new Error(errors.join(" | "));
  }


  if (inserted > 0) {
    try {
      await checkSubscriptions();
    } catch (error) {
      console.error("Abonelik bildirimi kontrolü başarısız:", error);
    }
  }

  return {
    success: true,
    message:
      errors.length > 0
        ? `Kısmi başarı. ${errors.join(" | ")}`
        : "Scrape tamamlandı.",
    inserted,
    updated,
    sources,
  };
}


export async function runRareBrandScrape(
  threshold = 40,
  perBrandPages = 12
): Promise<ScrapeJobResult> {
  const counts = await Car.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$brand", count: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>();
  for (const c of counts) countMap.set(normalizeBrand(c._id || ""), c.count);


  const rareBrands = POPULAR_BRANDS.filter(
    (b) => (countMap.get(normalizeBrand(b)) || 0) < threshold
  );

  let inserted = 0;
  let updated = 0;
  let saved = 0;
  const onListing = async (listing: ScrapedListing) => {
    const result = await saveListing(listing);
    if (result === "inserted") inserted += 1;
    if (result === "updated") updated += 1;
    if (result !== "skipped") saved += 1;
  };

  let fetched = 0;
  const errors: string[] = [];
  try {
    fetched = await scrapeArabamForBrands(rareBrands, perBrandPages, onListing);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  if (inserted > 0) {
    try {
      await checkSubscriptions();
    } catch (error) {
      console.error("Abonelik bildirimi kontrolü başarısız:", error);
    }
  }

  return {
    success: true,
    message:
      `Nadir-marka taraması: ${rareBrands.length} marka tarandı` +
      (errors.length > 0 ? ` (hata: ${errors.join(" | ")})` : "."),
    inserted,
    updated,
    sources: [{ source: "arabam", fetched, saved }],
  };
}


const RARE_MODEL_PAGES = 2;

const RARE_MODEL_LIMIT = 120;

const RARE_MODEL_MAX_LISTINGS = 1500;


export async function runRareModelScrape(
  threshold = 10,
  perModelPages = RARE_MODEL_PAGES,
  maxSegments = RARE_MODEL_LIMIT,
  maxListings = RARE_MODEL_MAX_LISTINGS
): Promise<ScrapeJobResult> {
  
  const segments = await Car.aggregate<{ _id: { brand: string; model: string }; count: number }>([
    { $group: { _id: { brand: "$brand", model: "$model" }, count: { $sum: 1 } } },
    { $match: { count: { $lt: threshold } } },
    
    { $sort: { count: 1 } },
    { $limit: maxSegments },
  ]);

  const targets = segments
    .map((s) => ({ brand: s._id?.brand || "", model: s._id?.model || "" }))
    .filter((s) => s.brand && s.model && s.model !== "Model" && s.model !== "Bilinmiyor");

  let inserted = 0;
  let updated = 0;
  let saved = 0;
  const onListing = async (listing: ScrapedListing) => {
    const result = await saveListing(listing);
    if (result === "inserted") inserted += 1;
    if (result === "updated") updated += 1;
    if (result !== "skipped") saved += 1;
  };

  let fetched = 0;
  const errors: string[] = [];
  try {
    fetched = await scrapeArabamForModels(targets, perModelPages, onListing, maxListings);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  if (inserted > 0) {
    try {
      await checkSubscriptions();
    } catch (error) {
      console.error("Abonelik bildirimi kontrolü başarısız:", error);
    }
  }

  return {
    success: true,
    message:
      `Nadir-model taraması: ${threshold} ilandan az olan ${targets.length} model tarandı` +
      (errors.length > 0 ? ` (hata: ${errors.join(" | ")})` : "."),
    inserted,
    updated,
    sources: [{ source: "arabam", fetched, saved }],
  };
}
export async function arabamRefreshStatus(): Promise<{ total: number; missingDamageParts: number }> {
  const [total, missingDamageParts] = await Promise.all([
    Car.countDocuments({ sourceSite: "arabam" }),
    Car.countDocuments({ sourceSite: "arabam", "damageParts.0": { $exists: false } }),
  ]);
  return { total, missingDamageParts };
}

export async function runPriceRefresh(limit = 500): Promise<ScrapeJobResult> {
  const stale = await Car.find({ sourceSite: "arabam", listingUrl: { $nin: ["", null] } })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .select("_id listingUrl")
    .lean<{ _id: mongoose.Types.ObjectId; listingUrl: string }[]>();

  const result = await refetchByUrls(stale, "Fiyat taraması");

  
  if (stale.length > 0) {
    await Car.updateMany(
      { _id: { $in: stale.map((d) => d._id) } },
      { $currentDate: { updatedAt: true } }
    );
  }

  return result;
}


export async function runAddressBackfill(limit = 2000): Promise<ScrapeJobResult> {
  const missing = await Car.find({
    sourceSite: "arabam",
    listingUrl: { $nin: ["", null] },
    $or: [{ address: "" }, { address: null }, { address: { $exists: false } }],
  })
    .limit(limit)
    .select("listingUrl")
    .lean<{ listingUrl: string }[]>();

  return refetchByUrls(missing, "Adres tamamlama");
}


async function refetchByUrls(
  docs: { listingUrl: string; _id?: mongoose.Types.ObjectId }[],
  label: string
): Promise<ScrapeJobResult> {
  const hrefToId = new Map<string, mongoose.Types.ObjectId>();
  const hrefs = docs
    .map((c) => {
      try {
        const href = new URL(c.listingUrl).pathname;
        if (c._id) hrefToId.set(href, c._id);
        return href;
      } catch {
        return null;
      }
    })
    .filter((h): h is string => !!h);

  let inserted = 0;
  let updated = 0;
  let saved = 0;
  const onListing = async (listing: ScrapedListing) => {
    const result = await saveListing(listing);
    if (result === "inserted") inserted += 1;
    if (result === "updated") updated += 1;
    if (result !== "skipped") saved += 1;
  };

  
  const goneIds: mongoose.Types.ObjectId[] = [];
  const onGone = (href: string) => {
    const id = hrefToId.get(href);
    if (id) goneIds.push(id);
  };

  let fetched = 0;
  const errors: string[] = [];
  try {
    fetched = await refetchArabamDetails(hrefs, onListing, onGone);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  if (goneIds.length > 0) {
    await Car.updateMany({ _id: { $in: goneIds }, status: { $ne: "sold" } }, { status: "removed" });
  }

  return {
    success: true,
    message:
      `${label}: ${hrefs.length} ilan yeniden çekildi, ${updated} güncellendi` +
      (goneIds.length > 0 ? `, ${goneIds.length} kaynaktan kaldırılmış olarak işaretlendi` : "") +
      (errors.length > 0 ? ` (hata: ${errors.join(" | ")})` : "."),
    inserted,
    updated,
    sources: [{ source: "arabam", fetched, saved }],
  };
}
