import type { Types } from "mongoose";
import { Car } from "@/models/Car";
import { SourceSyncState } from "@/models/SourceSyncState";
import { randomUUID } from "crypto";
import { enrichListing } from "@/lib/scraper/adapters";
import { createSaveCounter, saveListing } from "@/lib/scraper/run-scrape";
import { scrapeVavaCarsListings } from "@/lib/scraper/vavacars";
import { scrapeOtomerkeziListings } from "@/lib/scraper/otomerkezi";
import { scrapeOtokocListings } from "@/lib/scraper/otokoc";
import { scrapeOtoplusListings } from "@/lib/scraper/otoplus";
import { scrapeCarvakListings } from "@/lib/scraper/carvak";
import { dodExternalIdFromUrl, fetchDodCarUrls, scrapeDodDetails } from "@/lib/scraper/dod";
import { verifySingleListing } from "@/lib/scraper/verify-listing";
import {
  archiveListings,
  breakerTripped,
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
import { RECONCILE_SOURCES, type ReconcileSource } from "@/lib/scraper/reconcile-sources";
export { RECONCILE_SOURCES, type ReconcileSource };

const HOUR = 60 * 60 * 1000;
export const RECONCILE_INTERVAL_MS: Record<ReconcileSource, number> = {
  vavacars: 6 * HOUR, // 61 araç, 4 istek
  carvak: 12 * HOUR, // ~105 araç, ~5 istek
  otoplus: 12 * HOUR, // ~170 araç, ~15 istek
  otomerkezi: 12 * HOUR, // ~200 araç, ~15 istek
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

const RECONCILE_LEASE_MS = 2 * 60 * 60 * 1000;

async function claimReconcileLease(source: ReconcileSource, now: Date): Promise<string | null> {
  const owner = String(process.pid) + ":" + randomUUID();
  try {
    const state = await SourceSyncState.findOneAndUpdate(
      { source, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: null }, { leaseUntil: { $lt: now } }] },
      { $set: { leaseUntil: new Date(now.getTime() + RECONCILE_LEASE_MS), leaseOwner: owner }, $setOnInsert: { source } },
      { upsert: true, new: true }
    ).select("leaseOwner").lean<{ leaseOwner?: string }>();
    return state?.leaseOwner === owner ? owner : null;
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) return null;
    throw error;
  }
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
    .select("externalId status lastVerifiedAt lastVerifyAttemptAt")
    .lean<Array<{ externalId: string; status: string; lastVerifiedAt?: Date; lastVerifyAttemptAt?: Date }>>();
  const knownIds = new Set(known.map((k) => k.externalId));
  const fresh = [...byId.keys()].filter((id) => !knownIds.has(id)).slice(0, DOD_NEW_LIMIT);
  const returned = known.filter((k) => k.status === "removed").slice(0, DOD_NEW_LIMIT).map((k) => k.externalId);
  const stale = known
    .filter((k) => k.status === "active")
    .sort((a, b) => {
      const aAt = a.lastVerifyAttemptAt || a.lastVerifiedAt;
      const bAt = b.lastVerifyAttemptAt || b.lastVerifiedAt;
      return (aAt ? +new Date(aAt) : 0) - (bAt ? +new Date(bAt) : 0);
    })
    .slice(0, DOD_REFRESH_LIMIT)
    .map((k) => k.externalId);

  const items = [...fresh, ...returned, ...stale].map((externalId) => ({ externalId, url: byId.get(externalId) as string }));
  await scrapeDodDetails(
    items,
    onListing,
    (externalId, reason) => {
      seen.delete(externalId);
      (report.verifiedGone ||= []).push({ externalId, reason });
    },
    (externalId) =>
      Car.updateOne(
        { sourceSite: "dod", externalId, status: "active" },
        { $set: { lastVerifyAttemptAt: new Date() } },
        { timestamps: false }
      ).then(() => undefined)
  );
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
  const leaseOwner = await claimReconcileLease(source, now);
  if (!leaseOwner) {
    return {
      source,
      status: "incomplete",
      message: "Bu kaynağın envanter taraması başka bir süreçte sürüyor; bu tur atlandı.",
      seen: 0,
      inserted: 0,
      updated: 0,
      reactivated: 0,
      archived: 0,
      markedMissing: 0,
      durationMs: Date.now() - started,
    };
  }

  try {
    log("🔎 [" + source.toUpperCase() + "] Tam envanter taraması başladı...");
    try {
    await crawlInventory(
      source,
      async (listing) => {
        seen.add(listing.externalId);
        listing.identityAliases?.forEach((alias) => seen.add(alias));
        counter.add(await saveListing(listing, { markVerified: false }));
      },
      report,
      seen
    );
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
  }
  for (const externalId of report.observedIds || []) seen.add(externalId);

  const activeDocs = await Car.find({ sourceSite: source, status: "active" })
    .select("_id externalId listingUrl sourceSite missingSince missingChecks lastVerifyAttemptAt lastVerifiedAt")
    .lean<Array<{ _id: Types.ObjectId; externalId: string; listingUrl: string; sourceSite: string; missingSince?: Date; missingChecks?: number; lastVerifyAttemptAt?: Date; lastVerifiedAt?: Date }>>();

  // Görülen ilanlar tarama yarıda kalsa bile "canlı teyit edildi" sayılır.
  await markSeenAlive(activeDocs.filter((d) => seen.has(d.externalId)).map((d) => d._id), now);

  const { counts } = counter;
  const verifiedGoneById = new Map((report.verifiedGone || []).map((entry) => [entry.externalId, entry.reason]));
  const base = {
    source,
    seen: seen.size + verifiedGoneById.size,
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
      { source, leaseOwner },
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
        $unset: { leaseUntil: 1, leaseOwner: 1 },
      },
      { upsert: false }
    ).catch(() => {});
    log(`${status === "ok" ? "✅" : "⚠️"} [${source.toUpperCase()}] ${message}`);
    return result;
  };

  const summary = `Envanterde ${seen.size + verifiedGoneById.size} ilan (${report.pages} sayfa); yeni ${counts.inserted}, güncellenen ${counts.updated}, arşivden dönen ${counts.reactivated}.`;
  const incompleteReason = report.error || ((report.unsafeOmissions || 0) > 0 ? report.unsafeOmissions + " kimliksiz/ayırt edilemeyen kart" : "son sayfaya ulaşılamadı");
  if (!report.endedNaturally || report.error || (report.unsafeOmissions || 0) > 0) {
    return finish(
      "incomplete",
      summary + " Tarama güvenli biçimde tamamlanmadı (" + incompleteReason + "); kaynakta yok kararı verilmedi."
    );
  }

  const notSeen = activeDocs
    .filter((d) => !seen.has(d.externalId) && !verifiedGoneById.has(d.externalId))
    .sort((a, b) => {
      const aAt = a.lastVerifyAttemptAt || a.lastVerifiedAt;
      const bAt = b.lastVerifyAttemptAt || b.lastVerifiedAt;
      return (aAt ? +new Date(aAt) : 0) - (bAt ? +new Date(bAt) : 0);
    });
  const trust = inventoryLooksTrustworthy(activeDocs.length, seen.size + verifiedGoneById.size, notSeen.length);
  if (!trust.ok) {
    return finish("breaker", `${summary} Güvenlik freni: ${trust.reason}`);
  }

  // Detay sayfası anlamlı kaynaklarda kayıp ilanın kendi sayfasına da bak:
  // 404 ya da ilan numarası kaybolan yönlendirme → güçlü kanıt, hemen arşiv.
  const strongGone: Array<{ id: Types.ObjectId; reason: string }> = activeDocs.flatMap((doc) => {
    const reason = verifiedGoneById.get(doc.externalId);
    return reason ? [{ id: doc._id, reason: "DOD: " + reason }] : [];
  });
  const confirmedAlive: Types.ObjectId[] = [];
  let probeChecked = 0;
  let probeAlive = 0;
  const weak = [...notSeen];
  if (PROBE_SOURCES.has(source) && notSeen.length > 0) {
    const toProbe = notSeen.slice(0, PROBE_LIMITS[source] ?? 40);
    for (const doc of toProbe) {
      const result = await verifySingleListing(doc);
      probeChecked++;
      if (result.status === "gone" || result.status === "redirected") {
        strongGone.push({ id: doc._id, reason: result.reason });
        weak.splice(weak.indexOf(doc), 1);
      } else if (result.status === "active") {
        probeAlive++;
        confirmedAlive.push(doc._id);
        weak.splice(weak.indexOf(doc), 1);
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  if (strongGone.length > 0 && breakerTripped(probeChecked, strongGone.length, probeAlive)) {
    for (const gone of strongGone) {
      const doc = notSeen.find((candidate) => candidate._id.equals(gone.id));
      if (doc && !weak.includes(doc)) weak.push(doc);
    }
    strongGone.length = 0;
    log("[" + source.toUpperCase() + "] İlan sayfası doğrulama freni devrede; kaldırılma sonuçları bu turda beklemeye alındı.");
  }
  await markSeenAlive(confirmedAlive, now);

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
  } finally {
    await SourceSyncState.updateOne(
      { source, leaseOwner },
      { $unset: { leaseUntil: 1, leaseOwner: 1 } },
      { timestamps: false }
    ).catch(() => {});
  }
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
