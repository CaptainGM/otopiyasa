import mongoose from "mongoose";
import { Car } from "@/models/Car";
import {
  arabamAdapter,
  demoImportAdapter,
  otomerkeziAdapter,
  sahibindenAdapter,
  vavacarsAdapter,
  otoplusAdapter,
  carvakAdapter,
  otokocAdapter,
  dodAdapter,
  ikinciyeniAdapter,
  scrapeArabamForBrands,
  scrapeArabamForQuotas,
  scrapeArabamForMarketYears,
  refetchArabamDetails,
  fetchArabamByHrefs,
  createDetailFetchStats,
  arabamModelSlug,
  POPULAR_BRANDS,
} from "@/lib/scraper/adapters";
import { judgeAttempt, lastSlug, RETRY_DAYS, type AttemptReason } from "@/lib/scraper/model-page";
import { collectFamilyCandidates, type FamilySlugTarget } from "@/lib/scraper/sitemap-family";
import { reportEvent, reportProgress } from "@/lib/scraper/progress";
import { normalizeBrand, normalizeBrandModel } from "@/lib/normalize-brand";
import { notifyFavoritePriceDrop } from "@/lib/price-alerts";
import { checkSubscriptions } from "@/lib/subscriptions";
import { ScrapeAdapter, ScrapeJobResult, ScrapedListing, OnListing } from "@/lib/scraper/types";
import { LIFECYCLE, archiveListings, breakerTripped, markVerifyAttempt } from "@/lib/scraper/listing-lifecycle";
import { fetchDetailPatch, isDetailSource, mergeDetailIntoListing } from "@/lib/scraper/enrich-detail";
import { isPermanentRemoval, knownFeatureUpdates, PLATFORM_SCOPE_REASON } from "@/lib/scraper/feature-merge";
import { outOfScopeReason, vehicleClassOf } from "@/lib/vehicle-scope";
import { fuelWithTitleHint } from "@/lib/normalize-fuel";
import { normalizeCity } from "@/lib/normalize-city";
import { isIncompleteRemoval, lacksGallery } from "@/lib/scraper/listing-quality";
import { ListingSource } from "@/types";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { invalidateMarketSegments, selectSparseMarketSegments } from "@/lib/market-price";
import { modelFamily, modelFamilyKey, modelFamilyRegex, modelNameKey } from "@/lib/model-family";
import { RareModelAttempt } from "@/models/RareModelAttempt";
import { ArabamCatalog, type ArabamCatalogDoc } from "@/models/ArabamCatalog";
import { DAY_MS, familyId, planRareLevel, selectRareFamilies, type SegmentCount } from "@/lib/scraper/rare-models";

function pickAdapters(source: "sahibinden" | "arabam" | "otomerkezi" | "vavacars" | "otoplus" | "carvak" | "otokoc" | "dod" | "ikinciyeni" | "all"): ScrapeAdapter[] {
  if (source === "sahibinden") return [sahibindenAdapter];
  if (source === "arabam") return [arabamAdapter];
  if (source === "otomerkezi") return [otomerkeziAdapter];
  if (source === "vavacars") return [vavacarsAdapter];
  if (source === "otoplus") return [otoplusAdapter];
  if (source === "carvak") return [carvakAdapter];
  if (source === "otokoc") return [otokocAdapter];
  if (source === "dod") return [dodAdapter];
  if (source === "ikinciyeni") return [ikinciyeniAdapter];

  // Dağıtık rotasyon: Hızlı ve temiz kurumsal kaynaklar (Otokoç, VavaCars, Otoplus, DOD vb.)
  // arasına yayılarak Arabam'a tek seferde aşırı yük binmesi ve Cloudflare tetiklenmesi önlenir.
  return [
    otokocAdapter,
    vavacarsAdapter,
    otoplusAdapter,
    dodAdapter,
    otomerkeziAdapter,
    carvakAdapter,
    ikinciyeniAdapter,
    arabamAdapter,
  ];
}


function hasImages(listing: ScrapedListing): boolean {
  return Array.isArray(listing.images) && listing.images.length > 0;
}

export type SaveResult = "inserted" | "updated" | "reactivated" | "unchanged" | "skipped";

/** Değişmeyen ilanda "canlı görüldü" yazımını seyreltmek için (her keşif turunda yazmasın). */
const SEEN_WRITE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Kaynakta görülen bir ilanı kaydeder. Kaynakta görüldüğü için ilan aynı zamanda
 * "canlı teyit edildi" sayılır (lastVerifiedAt). `markVerified: false` toplu
 * işaretleme yapan çağıranlar (envanter senkronu) içindir.
 */
export async function saveListing(
  listing: ScrapedListing,
  options: { markVerified?: boolean } = {}
): Promise<SaveResult> {
  const markVerified = options.markVerified !== false;
  // Kaynaklar marka/model, yakıt ve ili farklı yazıyor ("Mercedes" + "- Benz C 180", "Benzin & LPG",
  // "Elaziğ"...); tek yazımla saklanır.
  listing = {
    ...listing,
    ...normalizeBrandModel(listing.brand, listing.model),
    city: listing.city ? normalizeCity(listing.city) : listing.city,
    features: { ...listing.features, fuelType: fuelWithTitleHint(listing.features?.fuelType, listing.title, listing.model) },
  };
  const now = new Date();
  const existing = await Car.findOne({
    sourceSite: listing.sourceSite,
    externalId: listing.externalId,
  });

  // Platform kapsamı (bkz. vehicle-scope.ts): ATV/UTV, deniz/hava aracı, kiralık ve araç olmayan ilanlar hiçbir
  // kaynaktan eklenmez; daha önce eklenmişse arşive alınır. Kapsamdaki her ilanın bir araç tipi vardır.
  const scopeInput = {
    brand: listing.brand,
    model: listing.model,
    title: listing.title,
    bodyType: listing.features?.bodyType,
    sourceCategory: listing.sourceCategory,
  };
  const scope = outOfScopeReason(scopeInput);
  const vehicleClass = vehicleClassOf(scopeInput);
  if (scope) {
    if (existing && existing.status !== "removed") {
      await archiveListings([existing._id], `${listing.sourceSite}: ${PLATFORM_SCOPE_REASON} (${scope})`, now);
    }
    return "skipped";
  }

  if (existing) {
    // "Eksik" diye arşive alınmış ilanı, liste sayfası yine tek fotoğraf veriyorsa geri açma.
    if (existing.status === "removed" && isIncompleteRemoval(existing.removedReason) && lacksGallery(listing.sourceSite, listing.images)) {
      return "unchanged";
    }
    // Yöneticinin elle kaldırdığı ya da kapsam dışı diye arşivlenen ilan, kaynakta görülse de geri açılmaz.
    if (existing.status === "removed" && isPermanentRemoval(existing.removedReason)) {
      return "unchanged";
    }
    // Detayı ilan sayfasından tamamlanmış kurumsal ilanlarda liste sayfasındaki şablon açıklama,
    // tek fotoğraf ve "Belirtilmemiş" alanlar zengin veriyi ezmemeli (aksi hâlde her tarama
    // galeriyi ve açıklamayı geri siliyordu).
    const detailKept = isDetailSource(listing.sourceSite) && Boolean((existing as any).detailCheckedAt);

    const oldPrice = existing.price;
    const newPrice = listing.price > 0 ? listing.price : existing.price;
    const priceChanged = existing.price !== newPrice && listing.price > 0;
    const mileageChanged = listing.mileage > 0 && Math.abs(existing.mileage - listing.mileage) > 50;
    const descChanged = Boolean(
      !detailKept &&
      listing.description &&
      listing.description !== existing.description &&
      listing.description.length > 20 &&
      Math.abs(listing.description.length - (existing.description?.length || 0)) > 5
    );
    const damageChanged = Boolean(
      listing.damageParts &&
      listing.damageParts.length > 0 &&
      JSON.stringify(listing.damageParts) !== JSON.stringify(existing.damageParts)
    );
    const imagesEnriched = Boolean(
      hasImages(listing) &&
      (!existing.images || existing.images.length === 0 || ((listing.images?.length || 0) > (existing.images?.length || 0) && (existing.images?.length || 0) <= 1))
    );
    const statusReactivated = existing.status === "removed" && listing.price > 0;
    // Kaynak adres formatını değiştirdiğinde (ör. VavaCars → tr.vava.cars) kayıt kendini onarsın.
    const urlChanged = Boolean(listing.listingUrl && listing.listingUrl !== existing.listingUrl);

    // Vites/yakıt/kasa/renk: kaynaklar artık yalnızca kendi verisinde yazan değeri ya da "Bilinmiyor" verir (tahmin
    // yok). Bilinen yeni değer yazılır; bilinmeyen değer kayıtlı bilgiyi asla ezmez (eskiden liste sayfasının
    // tahmini, ilan sayfasından okunmuş gerçek değerin üstüne her taramada yeniden yazılıyordu).
    const confirmedKeys = listing.confirmedFeatures || [];
    const storedFeatures = ((existing as any).features || {}) as Record<string, string | undefined>;
    const featureUpdates = knownFeatureUpdates(listing.features as Record<string, unknown>, storedFeatures);
    const featuresChanged = Object.keys(featureUpdates).length > 0;
    const storedVerified: string[] = (existing as any).verifiedFeatures || [];
    const needsVerifyFlag = confirmedKeys.some((key) => !storedVerified.includes(key));

    // Kaynağın kategorisi okunduysa (ilan/liste sayfası) tip kesindir; yoksa yalnızca boş tip doldurulur.
    const classChanged = listing.sourceCategory
      ? (existing as any).vehicleClass !== vehicleClass
      : !(existing as any).vehicleClass;

    const hasAnyChange =
      priceChanged || mileageChanged || descChanged || damageChanged || imagesEnriched || statusReactivated || urlChanged ||
      featuresChanged || needsVerifyFlag || classChanged;

    // GERÇEKTE HİÇBİR ŞEY DEĞİŞMEDİYSE içerik yazılmaz (updatedAt oynamaz);
    // yalnızca "canlı görüldü" bilgisi seyrek olarak işlenir.
    if (!hasAnyChange) {
      const lastSeen = existing.lastVerifiedAt ? new Date(existing.lastVerifiedAt).getTime() : 0;
      if (markVerified && (existing.missingSince || now.getTime() - lastSeen > SEEN_WRITE_INTERVAL_MS)) {
        await Car.updateOne(
          { _id: existing._id },
          { $set: { lastVerifiedAt: now, lastVerifyAttemptAt: now }, $unset: { missingSince: 1, missingChecks: 1, verifyPriorityAt: 1 } },
          { timestamps: false }
        );
      }
      return "unchanged";
    }

    existing.title = listing.title || existing.title;
    existing.brand = listing.brand || existing.brand;
    existing.model = listing.model || existing.model;
    if (listing.year > 0) existing.year = listing.year;
    existing.price = newPrice;
    if (listing.mileage > 0) existing.mileage = listing.mileage;
    existing.city = listing.city || existing.city;
    if (listing.address) existing.address = listing.address;
    if (listing.description && !detailKept) existing.description = listing.description;

    // Galeri hiçbir zaman küçülmez: liste sayfası tek fotoğraf verirken ilan sayfasından gelen galeri korunur.
    if (hasImages(listing) && (listing.images as string[]).length >= (existing.images?.length ?? 0)) {
      existing.images = listing.images as string[];
      existing.imageUrl = listing.imageUrl || (listing.images as string[])[0];
    }
    if (listing.damageFlag !== undefined && !detailKept) existing.damageFlag = listing.damageFlag;

    if (listing.damageParts && listing.damageParts.length > 0) {
      existing.damageParts = listing.damageParts;
    }
    if (listing.location) existing.location = listing.location;
    if (listing.features) {
      for (const [key, value] of Object.entries(featureUpdates)) existing.set(`features.${key}`, value);
      // Motor bilgileri: detayı ilan sayfasından tamamlanmış kurumsal ilanda liste verisi ezmez.
      if (!detailKept || confirmedKeys.length > 0) {
        for (const key of ["engineSize", "horsepower", "drivetrain", "avgFuelConsumption"] as const) {
          const value = listing.features[key];
          if (value !== undefined && value !== null && value !== "") existing.set(`features.${key}`, value);
        }
      }
    }
    existing.listingUrl = listing.listingUrl || existing.listingUrl;
    existing.source = listing.sourceSite;
    if (classChanged) (existing as any).vehicleClass = vehicleClass;
    if (confirmedKeys.length > 0) {
      (existing as any).featuresVerifiedAt = now;
      (existing as any).verifiedFeatures = [...new Set([...storedVerified, ...confirmedKeys])];
    }

    if (priceChanged) {
      existing.priceHistory.push({
        price: newPrice,
        recordedAt: new Date(),
      });
    }

    if (statusReactivated) {
      existing.status = "active";
      existing.removedAt = undefined;
      existing.removedReason = undefined;
      existing.needsRecheck = undefined;
    }
    if (markVerified) {
      existing.lastVerifiedAt = now;
      existing.lastVerifyAttemptAt = now;
      existing.missingSince = undefined;
      existing.missingChecks = undefined;
      (existing as any).verifyPriorityAt = undefined;
    }

    if (descChanged || mileageChanged || damageChanged || imagesEnriched) {
      const changedParts: string[] = [];
      if (descChanged) changedParts.push("Açıklama");
      if (mileageChanged) changedParts.push("Kilometre");
      if (damageChanged) changedParts.push("Hasar/Ekspertiz");
      if (imagesEnriched) changedParts.push("Fotoğraflar");

      (existing as any).lastDetailChange = {
        field: changedParts.join(", "),
        summary: `${changedParts.join(", ")} güncellendi`,
        changedAt: new Date(),
      };
    }

    if (priceChanged && newPrice < oldPrice) {
      try {
        await notifyFavoritePriceDrop(existing, oldPrice);
      } catch (error) {
        console.error("Fiyat düşüşü bildirimi başarısız:", error);
      }
    }

    await existing.save();
    return statusReactivated ? "reactivated" : "updated";
  }

  if (!(listing.price > 0)) {
    return "skipped";
  }

  // Yeni Otokoç/Otoplus ilanı: liste sayfası tek fotoğraf ve şablon açıklama verir; galeri,
  // teknik bilgi ve tramer için ilan sayfası da okunur. Okunamazsa ilan yine eklenir ve
  // arka plan tamamlayıcısı (runDetailBackfill) sonra yeniden dener.
  let toCreate = listing;
  let detailCheckedAt: Date | undefined;
  if (isDetailSource(listing.sourceSite)) {
    try {
      const patch = await fetchDetailPatch(listing.sourceSite, listing.listingUrl, listing.externalId, listing.title);
      if (patch) {
        toCreate = mergeDetailIntoListing(listing, patch);
        detailCheckedAt = now;
      }
    } catch {
      // ilan sayfası okunamadı: liste verisiyle devam
    }
  }

  // Galeri şartı olan kaynakta detay BAŞARIYLA okunup yine de galeri çıkmadıysa yeni ilan yayına alınmaz.
  // Okuma başarısızsa (ağ, bot koruması) ilan eskisi gibi eklenir; arka plan tamamlayıcı yeniden dener ve
  // ancak ikinci başarısız okumada arşive alır. Aksi hâlde geçici bir engel yeni ilanların tamamını düşürürdü.
  if (detailCheckedAt && lacksGallery(toCreate.sourceSite, toCreate.images)) {
    return "skipped";
  }

  await Car.create({
    ...toCreate,
    source: listing.sourceSite,
    priceHistory: [{ price: listing.price, recordedAt: now }],
    lastVerifiedAt: now,
    lastVerifyAttemptAt: now,
    detailCheckedAt,
    featuresVerifiedAt: (listing.confirmedFeatures?.length ?? 0) > 0 ? now : undefined,
    verifiedFeatures: listing.confirmedFeatures?.length ? listing.confirmedFeatures : undefined,
    vehicleClass,
  });
  return "inserted";
}

/** SaveResult'ları tek yerde sayar (her çağıran aynı sayacı tutuyordu). */
export function createSaveCounter() {
  const counts = { inserted: 0, updated: 0, reactivated: 0, unchanged: 0, saved: 0 };
  return {
    counts,
    add(result: SaveResult) {
      if (result === "inserted") counts.inserted += 1;
      if (result === "updated" || result === "reactivated") counts.updated += 1;
      if (result === "reactivated") counts.reactivated += 1;
      if (result === "unchanged") counts.unchanged += 1;
      if (result !== "skipped") counts.saved += 1;
    },
  };
}

export async function runScrapeJob(options: {
  source: "sahibinden" | "arabam" | "otomerkezi" | "vavacars" | "otoplus" | "carvak" | "otokoc" | "dod" | "ikinciyeni" | "all" | "demo";
  query: string;
  limit?: number;
  pageOffset?: number;
}): Promise<ScrapeJobResult> {
  const adapters =
    options.source === "demo"
      ? [demoImportAdapter]
      : pickAdapters(options.source);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let reactivated = 0;
  const sources: ScrapeJobResult["sources"] = [];
  const errors: string[] = [];
  const sampleVehicles: NonNullable<ScrapeJobResult["sampleVehicles"]> = [];

  for (const adapter of adapters) {
    let saved = 0;
    let adapterInserted = 0;
    let adapterUpdated = 0;

    const onListing = async (listing: ScrapedListing) => {
      const result = await saveListing(listing);
      if (result === "inserted") {
        inserted += 1;
        adapterInserted += 1;
      }
      if (result === "updated" || result === "reactivated") {
        updated += 1;
        adapterUpdated += 1;
      }
      if (result === "reactivated") reactivated += 1;
      if (result === "unchanged") unchanged += 1;
      if (result !== "skipped" && result !== "unchanged") {
        saved += 1;
        if (sampleVehicles.length < 16) {
          sampleVehicles.push({
            brand: listing.brand,
            model: listing.model,
            year: listing.year,
            price: listing.price,
            source: listing.sourceSite,
            title: listing.title,
            imageUrl: listing.imageUrl || (listing.images && listing.images[0]),
          });
        }
      }
    };

    try {
      const { fetched } = await adapter.scrape(
        options.query,
        options.limit || 12,
        onListing,
        options.pageOffset
      );
      sources.push({ source: adapter.id as ListingSource, fetched, saved, inserted: adapterInserted, updated: adapterUpdated });
    } catch (error) {
      errors.push(
        `${adapter.label}: ${
          error instanceof Error ? error.message : "bilinmeyen hata"
        }`
      );

      if (saved > 0) {
        sources.push({ source: adapter.id as ListingSource, fetched: saved, saved, inserted: adapterInserted, updated: adapterUpdated });
      }
    }
  }

  if (sources.length === 0 && errors.length > 0) {
    throw new Error(errors.join(" | "));
  }


  if (inserted > 0 || updated > 0) {
    try {
      const { invalidateCache } = await import("@/lib/cache");
      invalidateCache("home:deals");
    } catch (_) {}
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
    unchanged,
    reactivated,
    sources,
    sampleVehicles,
  };
}



export async function runRareBrandScrape(
  threshold = 40,
  perBrandPages = 12
): Promise<ScrapeJobResult> {
  const brandCounts = await Car.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$brand", count: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>();
  for (const c of brandCounts) countMap.set(normalizeBrand(c._id || ""), c.count);


  const rareBrands = POPULAR_BRANDS.filter(
    (b) => (countMap.get(normalizeBrand(b)) || 0) < threshold
  );

  const counter = createSaveCounter();
  const onListing = async (listing: ScrapedListing) => {
    counter.add(await saveListing(listing));
  };
  const { counts } = counter;

  let fetched = 0;
  const errors: string[] = [];
  try {
    fetched = await scrapeArabamForBrands(rareBrands, perBrandPages, onListing);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  if (counts.inserted > 0) {
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
    inserted: counts.inserted,
    updated: counts.updated,
    reactivated: counts.reactivated,
    sources: [{ source: "arabam", fetched, saved: counts.saved }],
  };
}


/** Aile başına en çok bu kadar liste sayfası (~20 ilan/sayfa); zaten kayıtlı ilanların detayı yeniden çekilmez. */
const RARE_MODEL_PAGES = 2;

/** Bu kadar ya da daha çok ilanı olan aileler nadir sayılmaz; kademeli ilerleme için geniş bir tavan (sabit hedef yok). */
const RARE_MODEL_CEILING = 100;

const RARE_MODEL_LIMIT = 120;

const RARE_MODEL_MAX_LISTINGS = 1500;

interface SitemapFill extends FamilySlugTarget {
  brand: string;
  model: string;
  familyKey: string;
}

/** Ailenin son denemesini (sonuç gerekçesi ve kaç gün sonra yeniden aranacağı) yazar. */
async function recordRareAttempt(
  brand: string,
  familyKey: string,
  model: string,
  verdict: { reason: AttemptReason; retryDays: number },
  facts: { found: number; added: number; before: number; after: number }
): Promise<void> {
  await RareModelAttempt.updateOne(
    { brand, familyKey },
    {
      $set: {
        model,
        attemptedAt: new Date(),
        found: facts.found,
        retryAfterDays: verdict.retryDays,
        reason: verdict.reason,
        added: facts.added,
        before: facts.before,
        after: facts.after,
      },
    },
    { upsert: true }
  ).catch(() => {});
}

/**
 * Kaynakta model sayfası olmayan ailelerin bizde olmayan ilanlarını site haritasından bulup detay sayfasından okur (bkz. sitemap-family.ts).
 * Site haritası tek seferde okunur (~2-3 dk), Cloudflare doğrulaması yoktur.
 */
async function fillUnavailableFromSitemap(
  targets: SitemapFill[],
  budget: number,
  catalogSlugs: string[],
  onListing: OnListing
): Promise<{ added: number; families: number }> {
  const known = new Set(
    (await Car.find({ sourceSite: "arabam" }, { externalId: 1 }).lean<Array<{ externalId?: string }>>())
      .map((d) => String(d.externalId || "").replace(/^arabam-/, ""))
      .filter(Boolean)
  );
  const candidates = await collectFamilyCandidates(targets, catalogSlugs, known, (done, total, entries) =>
    reportProgress(`Site haritası okunuyor (${done}/${total} dosya, ${entries.toLocaleString("tr-TR")} adres)`, done, total)
  );

  let added = 0;
  let families = 0;
  for (const [index, t] of targets.entries()) {
    if (added >= budget) break;
    const list = candidates.get(t.id) ?? [];
    reportProgress(`Site haritasından: ${t.brand} ${t.model} (${list.length} aday)`, index + 1, targets.length);
    const countFamily = () =>
      Car.countDocuments({ brand: t.brand, model: modelFamilyRegex(t.model, t.brand), status: "active" }).catch(() => undefined);
    const before = await countFamily();
    const hrefs = list.slice(0, Math.min(t.quota, budget - added)).map((c) => c.href);
    const got = hrefs.length > 0 ? await fetchArabamByHrefs(hrefs, onListing) : 0;
    added += got;
    const after = before === undefined ? undefined : await countFamily();
    if (got > 0) {
      families += 1;
      reportEvent({ label: `${t.brand} ${t.model}`, before, after, added: got });
    }
    const mismatch = got > 0 && before !== undefined && after !== undefined && after - before < got * 0.5;
    await recordRareAttempt(
      t.brand,
      t.familyKey,
      t.model,
      { reason: mismatch ? "mismatch" : "sitemap", retryDays: mismatch ? RETRY_DAYS.mismatch : got >= t.quota ? 0 : RETRY_DAYS.sitemap },
      { found: list.length, added: got, before: before ?? 0, after: after ?? 0 }
    );
  }
  return { added, families };
}

/**
 * Az ilanlı model AİLELERİNİ kaynakta arar. Amaç her marka-modelden en az [threshold] ilan olması; kaynakta yoksa olan çekilir ve
 * aile bırakılır. Sayım aile düzeyindedir, popüler markaların az ilanlı modelleri önce gelir, kaynakta tükenmiş aileler uzun süre
 * atlanır (bkz. rare-models.ts).
 */
export async function runRareModelScrape(
  threshold = RARE_MODEL_CEILING,
  perModelPages = RARE_MODEL_PAGES,
  maxSegments = RARE_MODEL_LIMIT,
  maxListings = RARE_MODEL_MAX_LISTINGS
): Promise<ScrapeJobResult> {
  // Kaynağın kendi model listesi: bizde hiç ilanı olmayan modeller de sıraya girer (sayıları 0). Yalnızca ad olarak kendi ailesini
  // veren satırlar alınır (donanım yazımları aileyi bölmesin).
  const catalogDocs = await ArabamCatalog.find().lean<ArabamCatalogDoc[]>();
  const catalogSegments: SegmentCount[] = [];
  for (const doc of catalogDocs) {
    const brand = normalizeBrand(doc.brand);
    for (const m of doc.models) {
      if (modelNameKey(modelFamily(m.name, brand)) !== modelNameKey(m.name)) continue;
      catalogSegments.push({ brand, model: m.name, count: 0, path: `${doc.category}/${m.slug}` });
    }
  }
  const catalogAgeDays = catalogDocs.length
    ? Math.floor((Date.now() - Math.max(...catalogDocs.map((d) => new Date(d.fetchedAt).getTime()))) / DAY_MS)
    : null;

  const counter = createSaveCounter();
  const { counts } = counter;
  const sampleVehicles: NonNullable<ScrapeJobResult["sampleVehicles"]> = [];
  const onListing = async (listing: ScrapedListing) => {
    const result = await saveListing(listing);
    counter.add(result);
    if (result !== "skipped") {
      if (sampleVehicles.length < 16) {
        sampleVehicles.push({
          brand: listing.brand,
          model: listing.model,
          year: listing.year,
          price: listing.price,
          source: listing.sourceSite,
          title: listing.title,
          imageUrl: listing.imageUrl || (listing.images && listing.images[0]),
        });
      }
    }
  };

  let fetched = 0;
  let processed = 0;
  let waiting = 0;
  let blocked = false;
  const levels: Array<{ level: number; models: number; added: number }> = [];
  const errors: string[] = [];
  // Kaynakta model sayfası olmayan (markanın sayfasına yönlenen) aileler: tur sonunda site haritasından aranır.
  const unavailable = new Map<string, SitemapFill>();

  // Bütçe bitene ya da uygun model kalmayana kadar kademe kademe ilerler: 5'in altındakiler 5'e çıkınca aynı tur 10. kademeye geçer.
  // Her taranan model ya kademesine ulaşır ya da bekleme listesine girer, bu yüzden her tur ilerleme sağlar.
  for (let round = 0; round < 40 && fetched < maxListings && !blocked; round++) {
    // Sayım, sitede görünen (aktif) ilanlar üzerinden: arşivdeki ilanlar bir modeli "yeterli" göstermemeli.
    const rows = await Car.aggregate<{ _id: { brand: string; model: string }; count: number }>([
      { $match: { status: "active" } },
      { $group: { _id: { brand: "$brand", model: "$model" }, count: { $sum: 1 } } },
    ]);
    const attempts = await RareModelAttempt.find({}, { brand: 1, familyKey: 1, attemptedAt: 1, retryAfterDays: 1 }).lean<
      Array<{ brand: string; familyKey: string; attemptedAt: Date; retryAfterDays?: number }>
    >();
    // Denenen aile not alınır; kota dolduysa beklemez, kaynakta tükenmişse 14, daha fazlası varsa 3 gün sonra yeniden denenir.
    const blockedUntil = new Map(
      attempts.map((a) => [familyId(a.brand, a.familyKey), a.attemptedAt.getTime() + (a.retryAfterDays ?? 3) * DAY_MS])
    );
    const nowMs = Date.now();
    waiting = [...blockedUntil.values()].filter((until) => until > nowMs).length;

    const eligible = selectRareFamilies(
      [...rows.map((r) => ({ brand: r._id?.brand || "", model: r._id?.model || "", count: r.count })), ...catalogSegments],
      threshold,
      Number.MAX_SAFE_INTEGER,
      blockedUntil,
      nowMs
    );
    const plan = planRareLevel(eligible, threshold, maxSegments);
    if (!plan) break;

    const targets = plan.targets;
    const familyKeyOf = new Map(targets.map((t) => [familyId(t.brand, t.model), t.familyKey]));
    let processedThisRound = 0;
    let roundFetched = 0;
    try {
      roundFetched = await scrapeArabamForQuotas(
        targets.map((t) => ({ brand: t.brand, model: t.model, quota: t.quota, path: t.path })),
        onListing,
        maxListings - fetched,
        {
          maxPages: Math.min(15, Math.max(perModelPages, Math.ceil(plan.level / 10) + 2)),
          onBlocked: () => {
            blocked = true;
          },
          onSegment: async (segment, result) => {
            const familyKey = familyKeyOf.get(familyId(segment.brand, segment.model));
            if (!familyKey) return;
            processedThisRound += 1;
            processed += 1;
            // Bekleme süresi sayfanın nasıl bittiğine göre (bkz. judgeAttempt): kademe dolduysa beklemez, kaynakta tükendiyse 14 gün, daha
            // fazlası varsa 3 gün; sayfa okunamadıysa 1 gün, model sayfası yoksa 7 gün (site haritasından aranır). Eklenenler aile sayısını
            // artırmıyorsa (başka model adıyla kaydoluyor) 14 gün.
            const verdict = judgeAttempt({
              outcome: result.outcome,
              added: result.added,
              fresh: result.fresh,
              before: result.before,
              after: result.after,
            });
            await recordRareAttempt(segment.brand, familyKey, segment.model, verdict, {
              found: result.found,
              added: result.added,
              before: result.before ?? 0,
              after: result.after ?? 0,
            });
            if (result.outcome === "unavailable") {
              const id = familyId(segment.brand, familyKey);
              if (!unavailable.has(id)) {
                const slug = segment.path ? lastSlug(segment.path) : arabamModelSlug(segment.brand, segment.model);
                unavailable.set(id, { id, brand: segment.brand, model: segment.model, familyKey, slug, quota: segment.quota });
              }
            }
          },
        }
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
      break;
    }
    fetched += roundFetched;
    levels.push({ level: plan.level, models: processedThisRound, added: roundFetched });
    if (processedThisRound === 0) break;
  }

  // Model sayfası olmayan ailelerin ilanları site haritasından (ilan adresindeki marka-model adıyla) bulunur.
  let sitemapNote = "";
  if (unavailable.size > 0 && !blocked) {
    try {
      // Site haritasını okumanın sabit bir maliyeti var (~2-3 dk); ana bütçe bitmiş olsa bile bu aileler için küçük bir pay ayrılır.
      const filled = await fillUnavailableFromSitemap(
        [...unavailable.values()].sort((a, b) => a.quota - b.quota),
        Math.max(maxListings - fetched, Math.min(60, unavailable.size * 4)),
        catalogDocs.flatMap((doc) => doc.models.map((m) => m.slug)),
        onListing
      );
      fetched += filled.added;
      sitemapNote = ` Model sayfası olmayan ${unavailable.size} aile site haritasından arandı: +${filled.added} ilan, ${filled.families} ailede.`;
    } catch (error) {
      sitemapNote = ` Model sayfası olmayan ${unavailable.size} aile için site haritası okunamadı (${error instanceof Error ? error.message : "hata"}).`;
    }
  } else if (unavailable.size > 0) {
    sitemapNote = ` Model sayfası olmayan ${unavailable.size} aile var; site haritası araması bir sonraki çalıştırmaya kaldı.`;
  }

  if (counts.inserted > 0) {
    try {
      await checkSubscriptions();
    } catch (error) {
      console.error("Abonelik bildirimi kontrolü başarısız:", error);
    }
  }

  const levelText = levels.length
    ? levels.map((l) => `${l.level} ilan kademesi: ${l.models} model, +${l.added}`).join("; ")
    : "taranacak uygun model kalmadı";
  return {
    success: true,
    message:
      `Nadir-model taraması (en azdan başlayıp kademe kademe): ${levelText}` +
      sitemapNote +
      (waiting > 0 ? ` (${waiting} aile bekleme süresinde: kaynakta yeni ilan çıkmış olabilir diye 1-14 gün sonra yeniden denenir)` : "") +
      (blocked ? " Kaynak hız sınırı koydu, tur erken durduruldu; hiçbir model 'tükendi' diye işaretlenmedi, biraz sonra yeniden çalıştırın." : "") +
      (catalogAgeDays !== null && catalogAgeDays > 14 ? ` Model kataloğu ${catalogAgeDays} gün önce okundu; scrape.bat 22 ile yenileyin.` : "") +
      (catalogAgeDays === null ? " Model kataloğu yok: scrape.bat 22 ile okuyun (kaynakta olup bizde hiç olmayan modeller bundan bulunur)." : "") +
      (errors.length > 0 ? ` (hata: ${errors.join(" | ")})` : ""),
    inserted: counts.inserted,
    updated: counts.updated,
    reactivated: counts.reactivated,
    sources: [{ source: "arabam", fetched, saved: counts.saved }],
    sampleVehicles,
  };
}

/** Aykırı değer temizliğinden sonra üçten az emsali kalan marka/model/yıl segmentlerini tamamlar. */
export async function runSparseMarketSegmentScrape(
  maxSegments = 100,
  pagesPerYear = 4,
  maxListings = 500
): Promise<ScrapeJobResult> {
  const groups = await Car.aggregate<{
    _id: { brand: string; model: string; year: number };
    prices: number[];
  }>([
    {
      $match: {
        ...PUBLIC_LISTING_FILTER,
        brand: { $type: "string", $ne: "" },
        model: { $type: "string", $nin: ["", "Model", "Bilinmiyor"] },
        year: { $type: "number", $gte: 1900 },
      },
    },
    {
      $group: {
        _id: { brand: "$brand", model: "$model", year: "$year" },
        prices: { $push: "$price" },
      },
    },
  ]);

  const sparseSegments = selectSparseMarketSegments(
    groups.map((group) => ({ ...group._id, prices: group.prices || [] })),
    maxSegments
  );

  if (sparseSegments.length === 0) {
    return {
      success: true,
      message: "Aykırı değer temizliğinden sonra tüm donanımlarıyla bile üçten az emsali kalan marka/model ailesi/yıl segmenti bulunamadı.",
      inserted: 0,
      updated: 0,
      sources: [{ source: "arabam", fetched: 0, saved: 0 }],
    };
  }

  // Arama model AİLESİ sayfasında yapılır ("toyota-corolla" + yıl filtresi). Eskiden donanım adıyla
  // ("toyota-corolla-1-6-vision") arandığı için sayfa çözülmüyor ve çoğu segment için hiç ilan gelmiyordu.
  const familyTargets = new Map<string, { brand: string; model: string; years: Set<number> }>();
  const allowedSegmentKeys = new Set<string>();
  const segmentsForInvalidation: Array<{ brand: string; model: string; year: number }> = [];
  for (const segment of sparseSegments) {
    const targetKey = `${segment.brand}::${segment.familyKey}`;
    const existing = familyTargets.get(targetKey) || {
      brand: segment.brand,
      model: segment.model,
      years: new Set<number>(),
    };
    existing.years.add(segment.year);
    familyTargets.set(targetKey, existing);
    allowedSegmentKeys.add(`${segment.brand}::${segment.familyKey}::${segment.year}`);
    segmentsForInvalidation.push(segment);
  }

  const counter = createSaveCounter();
  const { counts } = counter;
  const sampleVehicles: NonNullable<ScrapeJobResult["sampleVehicles"]> = [];
  const onListing = async (listing: ScrapedListing) => {
    const normalized = normalizeBrandModel(listing.brand, listing.model);
    const familyKey = modelFamilyKey(normalized.model, normalized.brand);
    if (!allowedSegmentKeys.has(`${normalized.brand}::${familyKey}::${listing.year}`)) return;
    const result = await saveListing(listing);
    counter.add(result);
    if (result !== "skipped" && sampleVehicles.length < 20) {
      sampleVehicles.push({
        brand: normalized.brand,
        model: normalized.model,
        year: listing.year,
        price: listing.price,
        source: listing.sourceSite,
        title: listing.title,
        imageUrl: listing.imageUrl || listing.images?.[0],
      });
    }
  };

  let fetched = 0;
  const errors: string[] = [];
  try {
    fetched = await scrapeArabamForMarketYears(
      [...familyTargets.values()].map((target) => ({ ...target, years: [...target.years] })),
      pagesPerYear,
      onListing,
      maxListings
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  invalidateMarketSegments(segmentsForInvalidation);
  if (counts.inserted > 0) {
    try {
      await checkSubscriptions();
    } catch (error) {
      console.error("Abonelik bildirimi kontrolü başarısız:", error);
    }
  }

  return {
    success: true,
    message:
      `Seyrek fiyat taraması: üçten az emsali kalan ${sparseSegments.length} marka/model ailesi/yıl segmenti, ${familyTargets.size} model ailesi tarandı` +
      (errors.length > 0 ? ` (hata: ${errors.join(" | ")})` : "."),
    inserted: counts.inserted,
    updated: counts.updated,
    reactivated: counts.reactivated,
    unchanged: counts.unchanged,
    sources: [{ source: "arabam", fetched, saved: counts.saved }],
    sampleVehicles,
  };
}

export async function arabamRefreshStatus(): Promise<{
  total: number;
  missingDamageParts: number;
  needsRecheck: number;
  neverVerified: number;
}> {
  const [total, missingDamageParts, needsRecheck, neverVerified] = await Promise.all([
    Car.countDocuments({ sourceSite: "arabam", status: { $ne: "removed" } }),
    Car.countDocuments({ sourceSite: "arabam", status: { $ne: "removed" }, "damageParts.0": { $exists: false } }),
    Car.countDocuments({ sourceSite: "arabam", status: "removed", needsRecheck: true }),
    Car.countDocuments({ sourceSite: "arabam", status: "active", lastVerifiedAt: { $exists: false } }),
  ]);
  return { total, missingDamageParts, needsRecheck, neverVerified };
}

type QueueRow = { _id: mongoose.Types.ObjectId; listingUrl: string; status?: string };

/**
 * Arabam detay taraması için sıradaki ilanlar, önem sırasıyla:
 *  1. Arşivde olup kaynakta hâlâ yayında görünenler (yanlış arşivlenmiş olabilir),
 *  2. Sitemap'te görünmeyen aktif ilanlar (ölme ihtimali yüksek; ölçümde ~1/3'ü ölü),
 *  3. En uzun süredir doğrulanmamış aktif ilanlar.
 * Son 6 saatte denenmiş (ör. engellenmiş) ilanlar atlanır ki kuyruk takılmasın.
 */
export async function pickArabamRefreshQueue(limit: number, now = new Date()): Promise<QueueRow[]> {
  const cooldown = new Date(now.getTime() - LIFECYCLE.attemptCooldownMs);
  const picked: QueueRow[] = [];
  const take = async (conditions: Record<string, unknown>[], sort: Record<string, 1 | -1>, max: number) => {
    if (max <= 0) return;
    const rows = await Car.find({
      $and: [
        { sourceSite: "arabam", listingUrl: { $nin: ["", null] } },
        { $or: [{ lastVerifyAttemptAt: { $exists: false } }, { lastVerifyAttemptAt: { $lt: cooldown } }] },
        { _id: { $nin: picked.map((p) => p._id) } },
        ...conditions,
      ],
    })
      .sort(sort)
      .limit(max)
      .select("_id listingUrl status")
      .lean<QueueRow[]>();
    picked.push(...rows);
  };

  await take([{ status: "removed" }, { needsRecheck: true }], { removedAt: -1 }, Math.ceil(limit * 0.25));
  await take(
    [
      { status: "active" },
      { sitemapMissingSince: { $exists: true } },
      { $expr: { $lt: [{ $ifNull: ["$lastVerifiedAt", new Date(0)] }, "$sitemapMissingSince"] } },
    ],
    { lastVerifiedAt: 1 },
    Math.ceil(limit * 0.25)
  );
  await take([{ status: "active" }], { lastVerifiedAt: 1 }, limit - picked.length);
  return picked;
}

export async function runPriceRefresh(limit = 500, progressOffset?: number, progressTotal?: number): Promise<ScrapeJobResult> {
  const queue = await pickArabamRefreshQueue(limit);
  const { result, aliveIds, goneIds, attemptedIds, blockedIds } = await refetchByUrls(queue, "Fiyat taraması", progressOffset, progressTotal);

  // Yalnızca gerçekten denenenler "denendi" olur (engelle yarıda bırakılan partinin kalanı kuyrukta başta kalır); engellenenler
  // "blocked" damgası alır ve 6 saat dinlendirilir.
  const blocked = new Set(blockedIds.map(String));
  await markVerifyAttempt(attemptedIds.filter((id) => !blocked.has(String(id))));
  await markVerifyAttempt(blockedIds, new Date(), "blocked");
  // Yeniden kontrol bayrağını yalnızca KESİN sonuç alınan arşiv kayıtlarında kaldır;
  // engellenen denemeler bir sonraki turda tekrar sıraya girsin.
  const decided = new Set([...aliveIds, ...goneIds].map(String));
  const settledRechecks = queue.filter((d) => d.status === "removed" && decided.has(String(d._id))).map((d) => d._id);
  if (settledRechecks.length > 0) {
    await Car.updateMany({ _id: { $in: settledRechecks } }, { $unset: { needsRecheck: 1 } }, { timestamps: false });
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

  return (await refetchByUrls(missing, "Adres tamamlama")).result;
}


async function refetchByUrls(
  docs: { listingUrl: string; _id?: mongoose.Types.ObjectId }[],
  label: string,
  progressOffset?: number,
  progressTotal?: number
): Promise<{
  result: ScrapeJobResult;
  aliveIds: mongoose.Types.ObjectId[];
  goneIds: mongoose.Types.ObjectId[];
  attemptedIds: mongoose.Types.ObjectId[];
  blockedIds: mongoose.Types.ObjectId[];
}> {
  const hrefToId = new Map<string, mongoose.Types.ObjectId>();
  // Adresi bozuk kayıtlar hiç denenemez; yine de "denendi" sayılır ki kuyruğun başında takılı kalmasınlar.
  const unparsableIds: mongoose.Types.ObjectId[] = [];
  const hrefs = docs
    .map((c) => {
      try {
        const href = new URL(c.listingUrl).pathname;
        if (c._id) hrefToId.set(href, c._id);
        return href;
      } catch {
        if (c._id) unparsableIds.push(c._id);
        return null;
      }
    })
    .filter((h): h is string => !!h);

  const counter = createSaveCounter();
  const { counts } = counter;
  const aliveIds: mongoose.Types.ObjectId[] = [];
  const onListing = async (listing: ScrapedListing) => {
    counter.add(await saveListing(listing));
    try {
      const id = hrefToId.get(new URL(listing.listingUrl).pathname);
      if (id) aliveIds.push(id);
    } catch {
      // geçersiz URL: sayaç yine de işlendi
    }
  };

  const goneIds: mongoose.Types.ObjectId[] = [];
  const onGone = (href: string) => {
    const id = hrefToId.get(href);
    if (id) goneIds.push(id);
  };

  let fetched = 0;
  const errors: string[] = [];
  const stats = createDetailFetchStats();
  try {
    fetched = await refetchArabamDetails(hrefs, onListing, onGone, progressOffset, progressTotal, stats);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }
  const idsOf = (set: Set<string>) => [...set].map((href) => hrefToId.get(href)).filter((id): id is mongoose.Types.ObjectId => !!id);
  const attemptedIds = [...idsOf(stats.attempted), ...unparsableIds];
  const blockedIds = idsOf(stats.blocked);

  // Arşivleme: ilan sayfası 404/410 verdi, kategori sayfasına yönlendi ya da
  // "yayında değil" yazıyor (güçlü kanıt). Yine de partinin büyük kısmı ölü
  // görünüyorsa bu bir engel/site değişikliğidir; hiçbir şey arşivlenmez.
  let archived = 0;
  let breakerNote = "";
  if (breakerTripped(fetched + goneIds.length, goneIds.length)) {
    breakerNote = ` DEVRE KESİCİ: ${goneIds.length}/${fetched + goneIds.length} ilan ölü göründü, arşivleme yapılmadı.`;
  } else {
    archived = await archiveListings(goneIds, "arabam: ilan sayfası kaldırılmış / kategoriye yönlendirilmiş");
  }

  return {
    aliveIds,
    goneIds: breakerNote ? [] : goneIds,
    attemptedIds,
    blockedIds,
    result: {
      success: true,
      checked: stats.attempted.size,
      blocked: stats.blocked.size,
      aborted: stats.aborted,
      message:
        `${label}: ${stats.attempted.size} ilan kontrol edildi` +
        (stats.blocked.size > 0 ? ` (${stats.blocked.size} tanesi engel yüzünden okunamadı${stats.aborted ? ", parti erken bırakıldı" : ""})` : "") +
        `, ${counts.updated} güncellendi` +
        (counts.reactivated > 0 ? `, ${counts.reactivated} arşivden geri alındı` : "") +
        (archived > 0 ? `, ${archived} kaynaktan kaldırılmış olarak arşivlendi` : "") +
        breakerNote +
        (errors.length > 0 ? ` (hata: ${errors.join(" | ")})` : "."),
      inserted: counts.inserted,
      updated: counts.updated,
      reactivated: counts.reactivated,
      deleted: archived,
      sources: [{ source: "arabam", fetched, saved: counts.saved }],
    },
  };
}
