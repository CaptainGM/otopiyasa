import { DiscoveryCandidate } from "@/models/DiscoveryCandidate";
import { Car } from "@/models/Car";
import { enrichListing, fetchArabamByHrefs } from "@/lib/scraper/adapters";
import { createSaveCounter, saveListing } from "@/lib/scraper/run-scrape";
import { fetchPageWithBrowser, isCloudflareChallenge, isListingGone, parseArabamDetailHtml } from "@/lib/scraper/browser-scrape";
import { waitForArabamTurn } from "@/lib/scraper/verify-listing";
import { hrefFromUrl } from "@/lib/scraper/arabam-sitemap";

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
  batch: Array<{ _id: unknown; externalId: string; url: string; attempts: number }>
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
      await DiscoveryCandidate.deleteOne({ _id: candidate._id });
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
        await DiscoveryCandidate.deleteOne({ _id: candidate._id });
        dropped++;
      } else {
        await DiscoveryCandidate.updateOne(
          { _id: candidate._id },
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
      await DiscoveryCandidate.deleteOne({ _id: candidate._id });
      dropped++;
      continue;
    }

    const listing = parseArabamDetailHtml(page.html, candidate.url);
    if (!page.status || page.status >= 400 || !listing || listing.price <= 0 || !listing.images?.length) {
      failed++;
      const attempts = candidate.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await DiscoveryCandidate.deleteOne({ _id: candidate._id });
        dropped++;
      } else {
        await DiscoveryCandidate.updateOne(
          { _id: candidate._id },
          { $set: { attempts, lastAttemptAt: new Date() } }
        );
      }
      continue;
    }

    try {
      const result = await saveListing(enrichListing(listing));
      const saved = await Car.exists({ sourceSite: "arabam", externalId: listing.externalId });
      if (saved) {
        await DiscoveryCandidate.deleteOne({ _id: candidate._id });
        if (result === "inserted") inserted++;
      } else {
        failed++;
        const attempts = candidate.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await DiscoveryCandidate.deleteOne({ _id: candidate._id });
          dropped++;
        } else {
          await DiscoveryCandidate.updateOne(
            { _id: candidate._id },
            { $set: { attempts, lastAttemptAt: new Date() } }
          );
        }
      }
    } catch {
      failed++;
      const attempts = candidate.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await DiscoveryCandidate.deleteOne({ _id: candidate._id });
        dropped++;
      } else {
        await DiscoveryCandidate.updateOne(
          { _id: candidate._id },
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

export async function runSitemapDiscovery(
  limit = 40,
  options: { safeForWatcher?: boolean } = {}
): Promise<DiscoveryResult> {
  const batch = await DiscoveryCandidate.find({ source: "arabam", attempts: { $lt: MAX_ATTEMPTS } })
    .sort({ numericId: -1 })
    .limit(limit)
    .lean<Array<{ _id: unknown; externalId: string; url: string; attempts: number }>>();

  if (batch.length === 0) {
    return { picked: 0, inserted: 0, dropped: 0, remaining: 0, message: "Keşif kuyruğu boş." };
  }

  if (options.safeForWatcher) {
    return runPacedBrowserDiscovery(batch);
  }

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

  if (done.length > 0) await DiscoveryCandidate.deleteMany({ _id: { $in: done } });
  if (failed.length > 0) {
    await DiscoveryCandidate.updateMany({ _id: { $in: failed } }, { $inc: { attempts: 1 }, $set: { lastAttemptAt: new Date() } });
  }
  // Son denemesini de harcayanlar (araç değil / kaldırılmış) kuyruktan atılır.
  const dropped = (await DiscoveryCandidate.deleteMany({ source: "arabam", attempts: { $gte: MAX_ATTEMPTS } })).deletedCount || 0;
  const remaining = await DiscoveryCandidate.countDocuments({ source: "arabam", attempts: { $lt: MAX_ATTEMPTS } });

  return {
    picked: batch.length,
    inserted: counter.counts.inserted,
    dropped,
    remaining,
    message: `Sitemap keşfi: ${batch.length} aday okundu, ${counter.counts.inserted} yeni ilan eklendi, ${dropped} aday elendi; kuyrukta ${remaining} aday kaldı.`,
  };
}
