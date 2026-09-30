import { DiscoveryCandidate } from "@/models/DiscoveryCandidate";
import { Car } from "@/models/Car";
import { fetchArabamByHrefs } from "@/lib/scraper/adapters";
import { createSaveCounter, saveListing } from "@/lib/scraper/run-scrape";
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
}

export async function runSitemapDiscovery(limit = 40): Promise<DiscoveryResult> {
  const batch = await DiscoveryCandidate.find({ source: "arabam", attempts: { $lt: MAX_ATTEMPTS } })
    .sort({ numericId: -1 })
    .limit(limit)
    .lean<Array<{ _id: unknown; externalId: string; url: string }>>();

  if (batch.length === 0) {
    return { picked: 0, inserted: 0, dropped: 0, remaining: 0, message: "Keşif kuyruğu boş." };
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
