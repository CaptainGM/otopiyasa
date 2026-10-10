import { randomUUID } from "crypto";
import { DiscoveryCandidate } from "@/models/DiscoveryCandidate";
import { Car } from "@/models/Car";
import { enrichListing, fetchArabamByHrefs } from "@/lib/scraper/adapters";
import { createSaveCounter, saveListing } from "@/lib/scraper/run-scrape";
import { fetchPageWithBrowser, isCloudflareChallenge, isListingGone, parseArabamDetailHtml } from "@/lib/scraper/browser-scrape";
import { waitForArabamTurn } from "@/lib/scraper/verify-listing";
import { hrefFromUrl, isSitemapSyncDue, lastmodCutoff, syncArabamSitemap } from "@/lib/scraper/arabam-sitemap";
import { reportEvent, reportProgress } from "@/lib/scraper/progress";

/**
 * Sitemap'ten gelen yeni ilan adaylarının detayını okur (arabam-sitemap.ts kuyruğu doldurur).
 *
 * En yeni ilanlar (en büyük numara) önce alınır. Detay sayfası Cloudflare arkasında; ev IP'sinde
 * gerçek tarayıcıyla açılır, engel sayfası gelirse aday silinmez (sonra yeniden denenir).
 * Bir aday en fazla MAX_ATTEMPTS kez denenir: araç olmayan ilanlar (motosiklet, yedek parça…)
 * ayrıştırılamadığı için sonsuza dek kuyrukta kalmasın.
 */
const MAX_ATTEMPTS = 2;

export interface DiscoveryResult {
  picked: number;
  inserted: number;
  dropped: number;
  remaining: number;
  message: string;
  blocked?: boolean;
  failed?: number;
}

async function runPacedBrowserDiscovery(
  batch: Array<{ _id: unknown; externalId: string; url: string; attempts: number }>,
  claimBy: string
): Promise<DiscoveryResult> {
  let picked = 0;
  let inserted = 0;
  let dropped = 0;
  let blocked = false;
  let failed = 0;

  for (const candidate of batch) {
    const externalId = `arabam-${candidate.externalId}`;
    const alreadySaved = await Car.exists({ sourceSite: "arabam", externalId });
    if (alreadySaved) {
      await DiscoveryCandidate.deleteOne({ _id: candidate._id, claimBy });
      continue;
    }

    // Paylaşılan bekleme kapısı: kontrol ve yeni ilan isteği aynı 10–40 sn hız sınırını kullanır.
    await waitForArabamTurn();
    let page: { html: string; finalUrl: string; status: number };
    try {
      page = await fetchPageWithBrowser(candidate.url, true);
    } catch {
      failed++;
      const attempts = candidate.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await DiscoveryCandidate.deleteOne({ _id: candidate._id, claimBy });
        dropped++;
      } else {
        await DiscoveryCandidate.updateOne(
          { _id: candidate._id, claimBy },
          { $set: { attempts, lastAttemptAt: new Date() } }
        );
      }
      continue;
    }
    picked++;

    if ([401, 403, 429].includes(page.status) || isCloudflareChallenge(page.html)) {
      // Engel adayı tüketmez; bekçi mevcut hız politikasını uygular ve daha sonra yeniden dener.
      blocked = true;
      break;
    }

    if (page.status === 404 || page.status === 410 || isListingGone(page.html, page.finalUrl)) {
      await DiscoveryCandidate.deleteOne({ _id: candidate._id, claimBy });
      dropped++;
      continue;
    }

    const listing = parseArabamDetailHtml(page.html, candidate.url);
    if (!page.status || page.status >= 400 || !listing || listing.price <= 0 || !listing.images?.length) {
      failed++;
      const attempts = candidate.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await DiscoveryCandidate.deleteOne({ _id: candidate._id, claimBy });
        dropped++;
      } else {
        await DiscoveryCandidate.updateOne(
          { _id: candidate._id, claimBy },
          { $set: { attempts, lastAttemptAt: new Date() } }
        );
      }
      continue;
    }

    try {
      const result = await saveListing(enrichListing(listing));
      const saved = await Car.exists({ sourceSite: "arabam", externalId: listing.externalId });
      if (saved) {
        await DiscoveryCandidate.deleteOne({ _id: candidate._id, claimBy });
        if (result === "inserted") inserted++;
      } else {
        failed++;
        const attempts = candidate.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await DiscoveryCandidate.deleteOne({ _id: candidate._id, claimBy });
          dropped++;
        } else {
          await DiscoveryCandidate.updateOne(
            { _id: candidate._id, claimBy },
            { $set: { attempts, lastAttemptAt: new Date() } }
          );
        }
      }
    } catch {
      failed++;
      const attempts = candidate.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await DiscoveryCandidate.deleteOne({ _id: candidate._id, claimBy });
        dropped++;
      } else {
        await DiscoveryCandidate.updateOne(
          { _id: candidate._id, claimBy },
          { $set: { attempts, lastAttemptAt: new Date() } }
        );
      }
    }
  }

  const remaining = await DiscoveryCandidate.countDocuments({ source: "arabam", attempts: { $lt: MAX_ATTEMPTS } });
  return {
    picked,
    inserted,
    dropped,
    remaining,
    blocked,
    failed,
    message: blocked
      ? `Cloudflare engeli görüldü; aday korunup bekçiye bırakıldı. Kuyrukta ${remaining} aday var.`
      : `Detay taraması: ${picked} sayfa açıldı, ${inserted} tam ilan eklendi, ${failed} aday yeniden denenecek, ${dropped} aday elendi; kuyrukta ${remaining} kaldı.`,
  };
}

/** Sitemap kuyruğu bu süreden eskiyse "son günler" taraması önce sitemap'i yeniler (yaklaşık 2-3 dk). */
const RECENT_SITEMAP_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const RECENT_BATCH = 25;
const RECENT_MAX_IDLE_BATCHES = 3;

export interface RecentScrapeResult {
  success: boolean;
  message: string;
  inserted: number;
  updated: number;
  deleted: number;
  sources: Array<{ source: string; fetched: number; saved: number }>;
}

/**
 * "En güncel ilanlar" taraması: sitemap'teki yeni ilan adaylarından son [days] gün içinde yayınlanan/güncellenenleri
 * en yeni numaradan başlayarak okur. Eski ilanlarla uğraşmaz; amaç sitenin son günlerin ilanlarıyla güncel kalması.
 * Kuyruk boşsa ya da son günlerin adayları bittiyse kendiliğinden durur.
 */
export async function runRecentArabamScrape(days = 3, maxCandidates = 600): Promise<RecentScrapeResult> {
  const notes: string[] = [];
  if (await isSitemapSyncDue(new Date(), RECENT_SITEMAP_MAX_AGE_MS)) {
    reportProgress("Sitemap okunuyor", 0, 1);
    const sync = await syncArabamSitemap({ log: (m) => console.log(m) });
    if (sync.status === "failed") notes.push(`sitemap yenilenemedi (${sync.message}); eldeki kuyrukla devam edildi`);
  }

  const windowTotal = await DiscoveryCandidate.countDocuments({
    source: "arabam",
    attempts: { $lt: MAX_ATTEMPTS },
    lastmod: { $gte: lastmodCutoff(days) },
  });
  const planned = Math.min(windowTotal, maxCandidates);
  if (planned === 0) {
    return {
      success: true,
      message: `Son ${days} günde eklenen, bizde olmayan ilan adayı yok${notes.length ? ` (${notes.join("; ")})` : ""}.`,
      inserted: 0,
      updated: 0,
      deleted: 0,
      sources: [{ source: "arabam", fetched: 0, saved: 0 }],
    };
  }

  let read = 0;
  let inserted = 0;
  let idle = 0;
  while (read < planned) {
    const r = await runSitemapDiscovery(Math.min(RECENT_BATCH, planned - read), { sinceDays: days });
    if (r.picked === 0) break;
    read += r.picked;
    inserted += r.inserted;
    reportProgress(`Son ${days} gün ilanları`, Math.min(read, planned), planned);
    if (r.inserted > 0) reportEvent({ label: `Son ${days} gün`, added: r.inserted });
    idle = r.inserted === 0 ? idle + 1 : 0;
    if (idle >= RECENT_MAX_IDLE_BATCHES) {
      notes.push(`art arda ${RECENT_MAX_IDLE_BATCHES} partide yeni ilan gelmedi (araç olmayan ilanlar ya da engel), durduruldu`);
      break;
    }
  }

  const left = await DiscoveryCandidate.countDocuments({
    source: "arabam",
    attempts: { $lt: MAX_ATTEMPTS },
    lastmod: { $gte: lastmodCutoff(days) },
  });
  return {
    success: true,
    message:
      `Son ${days} gün: ${read} aday okundu, ${inserted} yeni ilan eklendi; bu aralıkta ${left} aday sırada` +
      (notes.length ? ` (${notes.join("; ")})` : "."),
    inserted,
    updated: 0,
    deleted: 0,
    sources: [{ source: "arabam", fetched: read, saved: inserted }],
  };
}

export async function runSitemapDiscovery(
  limit = 40,
  options: { safeForWatcher?: boolean; sinceDays?: number } = {}
): Promise<DiscoveryResult> {
  const recentOnly = options.sinceDays && options.sinceDays > 0 ? { lastmod: { $gte: lastmodCutoff(options.sinceDays) } } : {};
  const batchLimit = Math.max(0, Math.min(100, Math.floor(Number.isFinite(limit) ? limit : 40)));
  if (batchLimit === 0) {
    const remaining = await DiscoveryCandidate.countDocuments({ source: "arabam", attempts: { $lt: MAX_ATTEMPTS }, ...recentOnly });
    return { picked: 0, inserted: 0, dropped: 0, remaining, message: "Keşif adedi sıfır; kuyruk değiştirilmedi." };
  }
  const now = new Date();
  const claimBy = `${process.pid}:${randomUUID()}`;
  const leaseMs = Math.max(2 * 60 * 60 * 1000, batchLimit * 60 * 1000);
  const batch: Array<{ _id: unknown; externalId: string; url: string; attempts: number }> = [];
  while (batch.length < batchLimit) {
    const candidate = await DiscoveryCandidate.findOneAndUpdate(
      {
        source: "arabam",
        attempts: { $lt: MAX_ATTEMPTS },
        ...recentOnly,
        $or: [{ claimUntil: { $exists: false } }, { claimUntil: null }, { claimUntil: { $lt: now } }],
      },
      { $set: { claimUntil: new Date(now.getTime() + leaseMs), claimBy } },
      { sort: { numericId: -1, _id: 1 }, new: true, timestamps: false }
    )
      .select("_id externalId url attempts")
      .lean<{ _id: unknown; externalId: string; url: string; attempts: number } | null>();
    if (!candidate) break;
    batch.push(candidate);
  }

  if (batch.length === 0) {
    const remaining = await DiscoveryCandidate.countDocuments({ source: "arabam", attempts: { $lt: MAX_ATTEMPTS }, ...recentOnly });
    return { picked: 0, inserted: 0, dropped: 0, remaining, message: remaining ? "Keşif kuyruğu başka bir işlem tarafından alındı." : "Keşif kuyruğu boş." };
  }

  try {
    if (options.safeForWatcher) return await runPacedBrowserDiscovery(batch, claimBy);

    const hrefs = batch.map((c) => hrefFromUrl(c.url)).filter((h): h is string => !!h);
    const counter = createSaveCounter();
    await fetchArabamByHrefs(hrefs, async (listing) => {
      counter.add(await saveListing(listing));
    });

    // Kaydedilenler (artık DB'de olanlar) kuyruktan çıkar; olmayanlar bir deneme daha harcar.
    const ids = batch.map((c) => `arabam-${c.externalId}`);
    const present = new Set(
      (await Car.find({ sourceSite: "arabam", externalId: { $in: ids } }).select("externalId").lean<Array<{ externalId: string }>>()).map(
        (c) => c.externalId
      )
    );
    const done = batch.filter((c) => present.has(`arabam-${c.externalId}`)).map((c) => c._id);
    const failed = batch.filter((c) => !present.has(`arabam-${c.externalId}`)).map((c) => c._id);

    if (done.length > 0) await DiscoveryCandidate.deleteMany({ _id: { $in: done }, claimBy });
    if (failed.length > 0) {
      await DiscoveryCandidate.updateMany(
        { _id: { $in: failed }, claimBy },
        { $inc: { attempts: 1 }, $set: { lastAttemptAt: new Date() } }
      );
    }
    // Son denemesini de harcayanlar (araç değil / kaldırılmış) kuyruktan atılır.
    const dropped = (await DiscoveryCandidate.deleteMany({ source: "arabam", attempts: { $gte: MAX_ATTEMPTS }, claimBy })).deletedCount || 0;
    const remaining = await DiscoveryCandidate.countDocuments({ source: "arabam", attempts: { $lt: MAX_ATTEMPTS } });

    return {
      picked: batch.length,
      inserted: counter.counts.inserted,
      dropped,
      remaining,
      message: `Sitemap keşfi: ${batch.length} aday okundu, ${counter.counts.inserted} yeni ilan eklendi, ${dropped} aday elendi; kuyrukta ${remaining} aday kaldı.`,
    };
  } finally {
    await DiscoveryCandidate.updateMany({ claimBy }, { $unset: { claimUntil: 1, claimBy: 1 } }, { timestamps: false }).catch(() => {});
  }
}
