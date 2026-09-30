import type { Types } from "mongoose";
import { Car } from "@/models/Car";
import { SourceSyncState } from "@/models/SourceSyncState";
import { enrichListing } from "@/lib/scraper/adapters";
import { createSaveCounter, saveListing } from "@/lib/scraper/run-scrape";
import { scrapeVavaCarsListings } from "@/lib/scraper/vavacars";
import { scrapeOtomerkeziListings } from "@/lib/scraper/otomerkezi";
import { scrapeOtokocListings } from "@/lib/scraper/otokoc";
import { scrapeOtoplusListings } from "@/lib/scraper/otoplus";
import { scrapeCarvakListings } from "@/lib/scraper/carvak";
import { scrapeIkinciyeniListings } from "@/lib/scraper/ikinciyeni";
import { dodExternalIdFromUrl, fetchDodCarUrls, scrapeDodDetails } from "@/lib/scraper/dod";
import { verifySingleListing } from "@/lib/scraper/verify-listing";
import {
  archiveListings,
  inventoryLooksTrustworthy,
  markSeenAlive,
  recordMissing,
} from "@/lib/scraper/listing-lifecycle";
import { newCrawlReport, type CrawlReport, type ScrapedListing } from "@/lib/scraper/types";

/**
 * TAM ENVANTER SENKRONU (Cloudflare'siz kurumsal kaynaklar)
 *
 * Eski yöntem her 3 dakikada 100 ilanın adresine "hâlâ açılıyor mu?" diye
 * bakıyordu: Otokoç'un her ilanı günde ~20 kez yoklanıyor, satılan araçlar ise
 * hiç yakalanmıyordu (sayfa 200 dönmeye devam ediyor; DB'de 1.638 aktif Otokoç
 * ilanı varken sitede ~1.300 araç vardı). Yeni yöntem kaynağın TÜM envanterini
 * belirli aralıklarla baştan sona tarar:
 *
 *  - Envanterde görülen her ilan kaydedilir: fiyat/km/fotoğraf değişikliği
 *    işlenir, arşivdeyse geri açılır, "canlı teyit edildi" olarak işaretlenir.
 *  - Tarama SONUNA KADAR tamamlandıysa, görünmeyen aktif ilanlar "kayıp"
 *    sayılır; detay sayfası anlamlı olan kaynaklarda ilan sayfasına da bakılır
 *    (404 / ilan numarası kaybolan yönlendirme → hemen arşiv), aksi hâlde ikinci
 *    gözlemde arşive taşınır (listing-lifecycle.ts kuralları).
 */
export const RECONCILE_SOURCES = ["vavacars", "carvak", "otoplus", "otomerkezi", "ikinciyeni", "otokoc", "dod"] as const;
export type ReconcileSource = (typeof RECONCILE_SOURCES)[number];

const HOUR = 60 * 60 * 1000;
export const RECONCILE_INTERVAL_MS: Record<ReconcileSource, number> = {
  vavacars: 6 * HOUR, // 61 araç, 4 istek
  carvak: 12 * HOUR, // ~105 araç, ~5 istek
  otoplus: 12 * HOUR, // ~170 araç, ~15 istek
  otomerkezi: 12 * HOUR, // ~200 araç, ~15 istek
  ikinciyeni: 12 * HOUR, // tek istek
  otokoc: 24 * HOUR, // ~1.300 araç, ~90 istek
  dod: 24 * HOUR, // sitemap + sınırlı detay yenileme
};
/** Başarısız/eksik biten senkron bu süre sonra yeniden denenir. */
const RETRY_AFTER_FAILURE_MS = 3 * HOUR;

/** İlan sayfası kesin kanıt veren kaynaklar (diğerleri: bkz. INVENTORY_ONLY_SOURCES). */
const PROBE_SOURCES = new Set<ReconcileSource>(["otokoc", "otoplus"]);
/**
 * Bir senkronda ilan sayfasına bakılacak "kayıp" ilan sayısı. Otokoç'ta DB'deki
 * aktiflerin ~%25-30'u sitede yok (satılmış ama kaydı kalmış); sayfaları kesin
 * kanıt verdiği için (soft 404) tek seferde çok sayıda ilan doğrulanır.
 */
const PROBE_LIMITS: Partial<Record<ReconcileSource, number>> = { otokoc: 400, otoplus: 60 };
const DOD_REFRESH_LIMIT = 120;
const DOD_NEW_LIMIT = 40;
const FULL_CRAWL_LIMIT = 100_000;

export interface ReconcileResult {
  source: ReconcileSource;
  status: "ok" | "incomplete" | "breaker" | "failed";
  message: string;
  seen: number;
  inserted: number;
  updated: number;
  reactivated: number;
  archived: number;
  markedMissing: number;
  durationMs: number;
}

async function crawlInventory(
  source: ReconcileSource,
  onListing: (listing: ScrapedListing) => Promise<void>,
  report: CrawlReport,
  seen: Set<string>
): Promise<void> {
  const wrap = (listing: ScrapedListing) => onListing(enrichListing(listing));
  switch (source) {
    case "vavacars":
      await scrapeVavaCarsListings(FULL_CRAWL_LIMIT, wrap, false, 1, report);
      return;
    case "otomerkezi":
      await scrapeOtomerkeziListings(FULL_CRAWL_LIMIT, wrap, 1, report);
      return;
    case "otokoc":
      await scrapeOtokocListings(FULL_CRAWL_LIMIT, wrap, false, 1, report);
      return;
    case "otoplus":
      await scrapeOtoplusListings(FULL_CRAWL_LIMIT, wrap, false, 1, report);
      return;
    case "carvak":
      await scrapeCarvakListings(FULL_CRAWL_LIMIT, wrap, false, 1, report);
      return;
    case "ikinciyeni":
      await scrapeIkinciyeniListings(50, wrap, false, report);
      return;
    case "dod":
      await crawlDodInventory(wrap, report, seen);
      return;
  }
}

/**
 * DOD'da envanter = sitemap. Sitemap'teki her araç "kaynakta var" sayılır;
 * fiyat güncellemesi için yalnızca yeni ilanlar, arşivdeyken sitemap'e geri
 * dönenler ve en uzun süredir detayına bakılmamış ilanlar açılır.
 */
async function crawlDodInventory(
  onListing: (l: ScrapedListing) => Promise<void>,
  report: CrawlReport,
  seen: Set<string>
) {
  const urls = await fetchDodCarUrls();
  report.pages = 1;
  if (urls.length === 0) {
    report.error = "DOD sitemap okunamadı ya da boş.";
    return;
  }
  report.endedNaturally = true;
  const byId = new Map(urls.map((url) => [dodExternalIdFromUrl(url) as string, url]));
  for (const id of byId.keys()) seen.add(id);

  const known = await Car.find({ sourceSite: "dod", externalId: { $in: [...byId.keys()] } })
    .select("externalId status lastVerifiedAt")
    .lean<Array<{ externalId: string; status: string; lastVerifiedAt?: Date }>>();
  const knownIds = new Set(known.map((k) => k.externalId));
  const fresh = [...byId.keys()].filter((id) => !knownIds.has(id)).slice(0, DOD_NEW_LIMIT);
  const returned = known.filter((k) => k.status === "removed").slice(0, DOD_NEW_LIMIT).map((k) => k.externalId);
  const stale = known
    .filter((k) => k.status === "active")
    .sort((a, b) => (a.lastVerifiedAt ? +new Date(a.lastVerifiedAt) : 0) - (b.lastVerifiedAt ? +new Date(b.lastVerifiedAt) : 0))
    .slice(0, DOD_REFRESH_LIMIT)
    .map((k) => k.externalId);

  const items = [...fresh, ...returned, ...stale].map((externalId) => ({ externalId, url: byId.get(externalId) as string }));
  await scrapeDodDetails(items, onListing);
}

export async function reconcileSource(
  source: ReconcileSource,
  options: { log?: (msg: string) => void } = {}
): Promise<ReconcileResult> {
  const log = options.log || (() => {});
  const started = Date.now();
  const now = new Date();
  const report = newCrawlReport();
  const seen = new Set<string>();
  const counter = createSaveCounter();

  log(`🔎 [${source.toUpperCase()}] Tam envanter taraması başladı...`);
  try {
    await crawlInventory(
      source,
      async (listing) => {
        seen.add(listing.externalId);
        counter.add(await saveListing(listing, { markVerified: false }));
      },
      report,
      seen
    );
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
  }

  const activeDocs = await Car.find({ sourceSite: source, status: "active" })
    .select("_id externalId listingUrl sourceSite missingSince missingChecks")
    .lean<Array<{ _id: Types.ObjectId; externalId: string; listingUrl: string; sourceSite: string; missingSince?: Date; missingChecks?: number }>>();

  // Görülen ilanlar tarama yarıda kalsa bile "canlı teyit edildi" sayılır.
  await markSeenAlive(activeDocs.filter((d) => seen.has(d.externalId)).map((d) => d._id), now);

  const { counts } = counter;
  const base = {
    source,
    seen: seen.size,
    inserted: counts.inserted,
    updated: counts.updated,
    reactivated: counts.reactivated,
  };
  const finish = async (
    status: ReconcileResult["status"],
    message: string,
    archived = 0,
    markedMissing = 0
  ): Promise<ReconcileResult> => {
    const result: ReconcileResult = { ...base, status, message, archived, markedMissing, durationMs: Date.now() - started };
    await SourceSyncState.findOneAndUpdate(
      { source },
      {
        $set: {
          lastRunAt: now,
          ...(status === "ok" ? { lastSuccessAt: now } : {}),
          lastStatus: status,
          lastMessage: message,
          complete: status === "ok",
          seen: result.seen,
          inserted: result.inserted,
          updated: result.updated,
          reactivated: result.reactivated,
          archived,
          markedMissing,
          durationMs: result.durationMs,
        },
      },
      { upsert: true }
    ).catch(() => {});
    log(`${status === "ok" ? "✅" : "⚠️"} [${source.toUpperCase()}] ${message}`);
    return result;
  };

  const summary = `Envanterde ${seen.size} ilan (${report.pages} sayfa); yeni ${counts.inserted}, güncellenen ${counts.updated}, arşivden dönen ${counts.reactivated}.`;
  if (!report.endedNaturally || report.error) {
    return finish(
      "incomplete",
      `${summary} Tarama tamamlanamadı (${report.error || "son sayfaya ulaşılamadı"}); kaynakta yok kararı verilmedi.`
    );
  }

  const notSeen = activeDocs.filter((d) => !seen.has(d.externalId));
  const trust = inventoryLooksTrustworthy(activeDocs.length, seen.size, notSeen.length);
  if (!trust.ok) {
    return finish("breaker", `${summary} Güvenlik freni: ${trust.reason}`);
  }

  // Detay sayfası anlamlı kaynaklarda kayıp ilanın kendi sayfasına da bak:
  // 404 ya da ilan numarası kaybolan yönlendirme → güçlü kanıt, hemen arşiv.
  const strongGone: Array<{ id: Types.ObjectId; reason: string }> = [];
  const weak = [...notSeen];
  if (PROBE_SOURCES.has(source) && notSeen.length > 0) {
    const toProbe = notSeen.slice(0, PROBE_LIMITS[source] ?? 40);
    for (const doc of toProbe) {
      const result = await verifySingleListing(doc);
      if (result.status === "gone" || result.status === "redirected") {
        strongGone.push({ id: doc._id, reason: result.reason });
        weak.splice(weak.indexOf(doc), 1);
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  let archived = 0;
  for (const g of strongGone) {
    archived += await archiveListings([g.id], `${source}: envanterde yok + ${g.reason}`, now);
  }
  const missing = await recordMissing(weak, `${source}: tam envanter taramasında art arda görünmedi`, now);
  archived += missing.archived;

  return finish(
    "ok",
    `${summary} Görünmeyen ${notSeen.length} ilandan ${archived} arşive taşındı, ${missing.marked} ilan izlemeye alındı.`,
    archived,
    missing.marked
  );
}

/** Sırası gelmiş (en çok gecikmiş) kaynak; yoksa null. */
export async function pickDueReconcileSource(now = new Date()): Promise<ReconcileSource | null> {
  const states = await SourceSyncState.find({ source: { $in: [...RECONCILE_SOURCES] } })
    .select("source lastRunAt lastStatus")
    .lean<Array<{ source: string; lastRunAt?: Date; lastStatus?: string }>>();
  const bySource = new Map(states.map((s) => [s.source, s]));

  let best: ReconcileSource | null = null;
  let bestOverdue = -1;
  for (const source of RECONCILE_SOURCES) {
    const state = bySource.get(source);
    const last = state?.lastRunAt ? new Date(state.lastRunAt).getTime() : 0;
    const interval =
      state && state.lastStatus && state.lastStatus !== "ok"
        ? Math.min(RECONCILE_INTERVAL_MS[source], RETRY_AFTER_FAILURE_MS)
        : RECONCILE_INTERVAL_MS[source];
    const overdue = now.getTime() - last - interval;
    if (overdue >= 0 && overdue > bestOverdue) {
      best = source;
      bestOverdue = overdue;
    }
  }
  return best;
}
