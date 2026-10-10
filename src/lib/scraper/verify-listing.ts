import type { Types } from "mongoose";
import { randomUUID } from "crypto";
import { Car } from "@/models/Car";
import { ScrapeThrottle } from "@/models/ScrapeThrottle";
import { isPlausibleScrapedPrice } from "@/lib/scraper/price-guard";
import {
  fetchPageWithBrowser,
  isCloudflareChallenge,
  isListingGone,
  isNonCarArabamPage,
  parseArabamDetailHtml,
  pickUserAgent,
} from "@/lib/scraper/browser-scrape";
import {
  LIFECYCLE,
  SCRAPED_SOURCE_FILTER,
  archiveListings,
  breakerTripped,
  arabamBreakerTripped,
  markSeenAlive,
  markVerifyAttempt,
} from "@/lib/scraper/listing-lifecycle";
import type { ScrapedListing } from "@/lib/scraper/types";

export interface VerifyListingResult {
  /**
   * active     → ilan kaynakta yayında (pozitif kanıt)
   * gone       → ilan kaldırılmış (404/410, "satıldı" yazısı, "sonuç bulunamadı")
   * redirected → ilan adresi başka bir sayfaya yönlendi (ilan artık yok)
   * blocked    → bot koruması / bölge filtresi / oran sınırı: HİÇBİR ŞEY KANITLAMAZ
   * error      → zaman aşımı veya anlaşılamayan yanıt: HİÇBİR ŞEY KANITLAMAZ
   */
  status: "active" | "gone" | "redirected" | "blocked" | "error";
  statusCode?: number;
  reason: string;
  finalUrl?: string;
  /** "active" çıkan Arabam ilanlarında, zaten indirilmiş sayfadan ayrıştırılan güncel veri (fiyat/km/açıklama yenilensin diye). */
  listing?: ScrapedListing;
}

export function statusAfterArchival(
  status: VerifyListingResult["status"] | "archived",
  archivedAt?: Date
): VerifyListingResult["status"] | "archived" {
  return archivedAt ? "archived" : status;
}

/**
 * Tek adres üzerinden doğrulanamayan kaynaklar; yalnızca tam envanter senkronuyla
 * (reconcile.ts) doğrulanır:
 *  - VavaCars, Carvak, İkinciyeni: tek sayfalık uygulama; her adres canlı da olsa
 *    satılmış da olsa aynı boş kabuğu döndürür (Carvak'ta 9 örnekte de 23.220 bayt).
 *  - Otomerkezi: aynı model-yıl için tek slug kullanılıyor, aynı adresi 7 farklı
 *    araç paylaşabiliyor.
 *  - DOD: sitemap'in kendisi envanterdir; detay sayfası bot korumasına takılıyor.
 */
export const INVENTORY_ONLY_SOURCES = new Set(["vavacars", "otomerkezi", "carvak", "ikinciyeni", "dod"]);

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

const GONE_TEXTS = [
  "araç satılmıştır",
  "bu araç satıldı",
  "araç satıldı",
  "ilan bulunamadı",
  "ilan yayından kaldırılmıştır",
  "bu ilan yayında değildir",
  "aradığınız ilan bulunamamıştır",
  "böyle bir ilan bulunamadı",
];

/** An HTTP 200 page without positive listing data is inconclusive, even if it contains a soft-404 string. */
export function classifyOtokocHtml(html: string): "live" | "unknown" {
  if (/"@type"\s*:\s*"(Product|Car|Vehicle)"/.test(html)) return "live";
  // The HTTP 200 shell embeds this text on live pages too. Treat it as inconclusive;
  // only an actual HTTP 404/410 response is strong enough to archive immediately.
  return "unknown";
}

/** Adresin sonundaki (ya da ?id= içindeki) ilan numarası. */
export function listingIdFromUrl(url: string): string | null {
  const q = url.match(/[?&]id=(\d{3,})/);
  if (q) return q[1];
  const m = url.match(/(\d{5,})\/?(?:[?#].*)?$/);
  return m ? m[1] : null;
}

/**
 * Yönlendirme sonrası adres ilanı hâlâ temsil ediyor mu? İlan numarası
 * kaybolduysa (ör. Otoplus satılan ilanı model kataloğuna yönlendiriyor:
 * `.../-574590` → `/kia/sportage`) ilan artık yoktur. Ana sayfaya yönlendirme
 * bot/bölge filtresi de olabileceği için kanıt sayılmaz.
 */
export function classifyRedirect(originalUrl: string, finalUrl: string): "same" | "root" | "lost-id" | "moved" {
  if (!finalUrl || finalUrl === originalUrl) return "same";
  let path = "";
  try {
    path = new URL(finalUrl).pathname.replace(/\/+$/, "");
  } catch {
    return "moved";
  }
  if (path === "") return "root";
  const id = listingIdFromUrl(originalUrl);
  if (id && !finalUrl.includes(id)) return "lost-id";
  return "moved";
}

/**
 * Arabam ilan sayfaları arasındaki en kısa süre. Her ilan gerçek tarayıcıyla açılıyor; araya bekleme
 * konmayınca (ve 3 işçiyle) saniyede ~3 sayfa gidiyor, ilk ~60 sayfadan sonra Cloudflare hız sınırı
 * her şeyi "doğrulama sayfası"na çeviriyordu (2 dakikada 400 ilan denendi, 336'sı engellendi).
 */
export const ARABAM_PAGE_GAP_MS = { min: 1500, spread: 900 };

/** Arka plan doğrulayıcı (scripts/arabam-bekci.ts) ilanlar arası beklemeyi kendi hızına göre ayarlar. */
export function setArabamPageGap(minMs: number, spreadMs: number): void {
  ARABAM_PAGE_GAP_MS.min = Math.max(0, minMs);
  ARABAM_PAGE_GAP_MS.spread = Math.max(0, spreadMs);
  arabamGapConfigWrite = ScrapeThrottle.updateOne(
    { key: ARABAM_RATE_GATE },
    {
      $set: {
        configuredGapMs: ARABAM_PAGE_GAP_MS.min + ARABAM_PAGE_GAP_MS.spread / 2,
        configUntil: new Date(Date.now() + 30 * 60_000),
      },
      $setOnInsert: { key: ARABAM_RATE_GATE },
    },
    { upsert: true, timestamps: false }
  )
    .catch(async (error) => {
      if (!isDuplicateKeyError(error)) throw error;
      await ScrapeThrottle.updateOne(
        { key: ARABAM_RATE_GATE },
        {
          $set: {
            configuredGapMs: ARABAM_PAGE_GAP_MS.min + ARABAM_PAGE_GAP_MS.spread / 2,
            configUntil: new Date(Date.now() + 30 * 60_000),
          },
        },
        { timestamps: false }
      );
    })
    .then(() => undefined);
}

const ARABAM_RATE_GATE = "arabam";
let arabamRateGateReady: Promise<void> | null = null;
let arabamGapConfigWrite: Promise<void> = Promise.resolve();

function isDuplicateKeyError(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === 11000;
}

async function ensureArabamRateGate(): Promise<void> {
  if (!arabamRateGateReady) {
    arabamRateGateReady = ScrapeThrottle.updateOne(
      { key: ARABAM_RATE_GATE },
      { $setOnInsert: { key: ARABAM_RATE_GATE } },
      { upsert: true, timestamps: false }
    )
      .then(() => undefined)
      .catch((error) => {
        // Başka bir süreç aynı anda upsert etmiş olabilir; unique anahtar aynı kapıyı kullanır.
        if (isDuplicateKeyError(error)) return;
        arabamRateGateReady = null;
        throw error;
      });
  }
  await arabamRateGateReady;
}

/** Mongo lease makes the request gap shared by multiple machines using the same database. */
export async function waitForArabamTurn(): Promise<void> {
  await arabamGapConfigWrite;
  await ensureArabamRateGate();
  const configured = await ScrapeThrottle.findOne({ key: ARABAM_RATE_GATE, configUntil: { $gt: new Date() } })
    .select("configuredGapMs")
    .lean<{ configuredGapMs?: number } | null>();
  const localGapMs = ARABAM_PAGE_GAP_MS.min + Math.random() * ARABAM_PAGE_GAP_MS.spread;
  const gapMs = Math.max(localGapMs, configured?.configuredGapMs || 0);

  while (true) {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + gapMs);
    const gate = await ScrapeThrottle.findOneAndUpdate(
      {
        key: ARABAM_RATE_GATE,
        $or: [
          { nextAllowedAt: { $exists: false } },
          { nextAllowedAt: null },
          { nextAllowedAt: { $lte: now } },
        ],
      },
      { $set: { nextAllowedAt: leaseUntil } },
      { new: true, upsert: false, timestamps: false }
    )
      .select("nextAllowedAt")
      .lean<{ nextAllowedAt?: Date } | null>();

    if (gate) return;

    const current = await ScrapeThrottle.findOne({ key: ARABAM_RATE_GATE })
      .select("nextAllowedAt")
      .lean<{ nextAllowedAt?: Date } | null>();
    const until = current?.nextAllowedAt ? new Date(current.nextAllowedAt).getTime() : Date.now();
    const waitMs = Math.max(50, Math.min(until - Date.now(), 30_000));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/**
 * Bir kaynakta art arda gelen "blocked" sayısını tutar. Sınıra ulaşan kaynağa o çalıştırmada ara
 * verilir: engel varken yüzlerce ilanı boşuna denemek hem engeli uzatır hem de her ilana 6 saatlik
 * "denendi" damgası vurup doğrulamayı geciktirir.
 */
export class BlockStreak {
  private streak = new Map<string, number>();
  private paused = new Set<string>();

  constructor(private readonly limit = 4) {}

  /** Sonucu işler; kaynak bu çağrıyla durdurulduysa true döner. */
  record(source: string, status: string): boolean {
    if (status !== "blocked") {
      this.streak.set(source, 0);
      return false;
    }
    const next = (this.streak.get(source) || 0) + 1;
    this.streak.set(source, next);
    if (next >= this.limit && !this.paused.has(source)) {
      this.paused.add(source);
      return true;
    }
    return false;
  }

  isPaused(source: string): boolean {
    return this.paused.has(source);
  }

  get pausedSources(): string[] {
    return [...this.paused];
  }
}

async function verifyArabamWithBrowser(listingUrl: string): Promise<VerifyListingResult> {
  if (process.env.DISABLE_PLAYWRIGHT === "true" || process.env.VERCEL) {
    return { status: "blocked", reason: "Bu ortamda tarayıcı yok; doğrulama atlandı (ilan korunur)." };
  }
  try {
    await waitForArabamTurn();
    const page = await fetchPageWithBrowser(listingUrl, true);
    if (isCloudflareChallenge(page.html)) {
      return { status: "blocked", finalUrl: page.finalUrl, reason: "Cloudflare doğrulama sayfası (ilan korunur)." };
    }
    if (page.status === 404 || page.status === 410) {
      return { status: "gone", statusCode: page.status, finalUrl: page.finalUrl, reason: `HTTP ${page.status}: İlan bulunamadı.` };
    }
    if (isListingGone(page.html, page.finalUrl)) {
      return {
        status: "gone",
        statusCode: page.status,
        finalUrl: page.finalUrl,
        reason: "İlan sayfası kaldırılmış (kategori sayfasına yönlendi ya da 'yayında değil' yazıyor).",
      };
    }
    if (/\/ilan\//.test(page.finalUrl) && isNonCarArabamPage(page.html)) {
      // ATV/UTV, deniz aracı, kiralık ya da hat-plaka ilanı yanlışlıkla eklenmiş: kapsam dışı olduğu kesin, arşive alınır.
      return {
        status: "gone",
        statusCode: page.status,
        finalUrl: page.finalUrl,
        reason: "Platform dışı araç (ATV/UTV, deniz aracı, kiralık ya da hat-plaka kategorisinde).",
      };
    }
    if (/\/ilan\//.test(page.finalUrl) && /"@type"\s*:\s*"Car"/.test(page.html)) {
      // Sayfa zaten indirildi; aynı HTML'den fiyat/km/açıklama da okunur ki "canlı" ilanlar
      // yalnızca tarih değil, gerçek içerik de güncellensin (bkz. saveListing çağıran taraf).
      let listing: ScrapedListing | undefined;
      try {
        const { enrichListing } = await import("@/lib/scraper/adapters");
        const parsed = parseArabamDetailHtml(page.html, page.finalUrl);
        listing = parsed ? enrichListing(parsed) : undefined;
      } catch {
        // ayrıştırma başarısızsa yalnızca "canlı" bilgisi kalır, ilana dokunulmaz
      }
      return { status: "active", statusCode: page.status, finalUrl: page.finalUrl, reason: "İlan sayfası canlı (tarayıcıyla doğrulandı).", listing };
    }
    return { status: "error", statusCode: page.status, finalUrl: page.finalUrl, reason: "İlan sayfası tanınamadı (ilan korunur)." };
  } catch (err: any) {
    return { status: "blocked", reason: `Tarayıcı doğrulaması başarısız (ilan korunur): ${err?.message || err}` };
  }
}

/**
 * Tek bir ilanın kaynakta hâlâ yayında olup olmadığını test eder. Yalnızca
 * pozitif kanıt "gone/redirected" döndürür; belirsiz her durum "blocked/error"dur.
 */
export async function verifySingleListing(car: {
  sourceSite?: string;
  listingUrl?: string;
  externalId?: string;
}): Promise<VerifyListingResult> {
  const url = car.listingUrl;
  if (!url) {
    return { status: "error", reason: "İlan bağlantısı (listingUrl) bulunamadı." };
  }
  if (car.sourceSite && INVENTORY_ONLY_SOURCES.has(car.sourceSite)) {
    return {
      status: "error",
      reason: "Bu kaynak tek adresten doğrulanamıyor; tam envanter senkronuyla doğrulanır.",
    };
  }

  if (car.sourceSite === "arabam") {
    // Yalnızca ilanın KENDİ sayfası açılır. Eskiden `/ikinci-el?searchText=<no>` aranıyordu; Arabam'ın
    // robots.txt'i bu deseni (ve `?sort=`) yasaklıyor. İlan sayfası yasaklı değil; Cloudflare nedeniyle
    // gerçek tarayıcı ve Türkiye ev IP'si gerekir, aksi hâlde sonuç "blocked" olur ve ilana dokunulmaz.
    return verifyArabamWithBrowser(url);
  }
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": car.sourceSite === "dod" ? MOBILE_UA : pickUserAgent(),
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    const finalUrl = res.url || url;

    if (res.status === 404 || res.status === 410) {
      return { status: "gone", statusCode: res.status, finalUrl, reason: `HTTP ${res.status}: İlan yayından kaldırılmış.` };
    }
    if (res.status === 429 || res.status === 403) {
      return { status: "blocked", statusCode: res.status, finalUrl, reason: `Erişim engeli (HTTP ${res.status}).` };
    }
    if (!res.ok) {
      return { status: "error", statusCode: res.status, finalUrl, reason: `Sunucu yanıtı: HTTP ${res.status}` };
    }

    const redirect = classifyRedirect(url, finalUrl);
    if (redirect === "root") {
      return {
        status: "blocked",
        statusCode: res.status,
        finalUrl,
        reason: "Ana sayfaya yönlendirildi (bot/bölge filtresi olabilir; ilan korunur).",
      };
    }
    if (redirect === "lost-id") {
      return {
        status: "redirected",
        statusCode: res.status,
        finalUrl,
        reason: "İlan adresi, ilan numarasını içermeyen bir sayfaya yönlendi (satılmış/kaldırılmış).",
      };
    }

    const html = await Promise.race([
      res.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("HTML okuma zaman aşımı")), 6000)),
    ]);
    if (isCloudflareChallenge(html)) {
      return { status: "blocked", statusCode: res.status, finalUrl, reason: "Bot doğrulama sayfası (ilan korunur)." };
    }
    if (car.sourceSite === "otokoc") {
      const kind = classifyOtokocHtml(html);
      if (kind === "unknown") {
        return { status: "error", statusCode: res.status, finalUrl, reason: "Otokoç sayfasında ilan verisi bulunamadı (ilan korunur)." };
      }
      return { status: "active", statusCode: res.status, finalUrl, reason: "İlan verisi sayfada mevcut (canlı)." };
    }
    const lower = html.toLocaleLowerCase("tr-TR");
    const goneText = GONE_TEXTS.find((t) => lower.includes(t));
    if (goneText) {
      return { status: "gone", statusCode: res.status, finalUrl, reason: `Sayfada '${goneText}' ibaresi var.` };
    }
    return { status: "active", statusCode: res.status, finalUrl, reason: "İlan orijinal sitede canlı ve yayında (HTTP 200)." };
  } catch (err: any) {
    return { status: "error", reason: `Ağ hatası: ${err?.message || "Bağlantı zaman aşımına uğradı"}` };
  }
}

/**
 * Canlı doğrulama sırasında okunan ilan, kayıtlı ilanı bozmadan yenilemek için süzülür:
 *  - satıcı açıklama yazmamışsa ayrıştırıcının uydurduğu "<başlık> - Arabam ilanı" metni mevcut açıklamayı ezmesin,
 *  - fiyat okunamadıysa ya da eskisinin %20'sinin altına / 5 katının üstüne çıktıysa (ayrıştırma hatası)
 *    fiyat değişmesin.
 */
export function sanitizeRefresh(listing: ScrapedListing, oldPrice?: number): ScrapedListing {
  const out: ScrapedListing = { ...listing };
  if (/- Arabam ilanı$/.test(out.description || "")) out.description = "";
  if (!isPlausibleScrapedPrice(oldPrice, out.price)) out.price = 0;
  return out;
}

type SweepDetail = {
  id: string;
  title: string;
  source: string;
  status: VerifyListingResult["status"] | "archived";
  reason: string;
  checkedAt: Date;
  archivedAt?: Date;
  updatedAt?: Date;
  updated?: boolean;
};

/**
 * Sıradaki (en uzun süredir doğrulanmamış) ilanları kaynaklarında tek tek
 * kontrol eder. Kaldırılanlar arşive taşınır; canlılar "doğrulandı" işaretlenir;
 * belirsizler dokunulmadan bırakılır (yalnızca deneme zamanı yazılır).
 */
export async function sweepAndCleanDeadListings(options: {
  limit?: number;
  source?: string;
  excludeSource?: string;
  /** Önceki turlarda engellenip durdurulan kaynaklar (yeniden denenmez). */
  excludeSources?: string[];
  concurrency?: number;
  maxDurationMs?: number;
  onProgress?: (processed: number, total: number, archived: number) => void;
} = {}): Promise<{
  checked: number;
  archived: number;
  active: number;
  /** Canlı çıkıp fiyatı/bilgisi değişen (kaydı güncellenen) ilan sayısı. */
  updated: number;
  errors: number;
  breaker: string[];
  /** Bu turda art arda engel yüzünden durdurulan kaynaklar. */
  pausedSources: string[];
  details: SweepDetail[];
}> {
  const limit = Math.min(options.limit || 50, 250);
  const concurrency = Math.min(options.concurrency || 3, 8);
  const now = new Date();
  const cooldown = new Date(now.getTime() - LIFECYCLE.attemptCooldownMs);

  const sourceFilter: Record<string, unknown> =
    options.source && options.source !== "all"
      ? { sourceSite: options.source }
      : { sourceSite: { $nin: [...INVENTORY_ONLY_SOURCES, ...(options.excludeSource ? [options.excludeSource] : []), ...(options.excludeSources || [])] } };

  type Candidate = { _id: Types.ObjectId; title: string; sourceSite: string; listingUrl: string; externalId?: string; price?: number };
  const baseFilter = [
    { status: "active", listingUrl: { $nin: ["", null] } },
    SCRAPED_SOURCE_FILTER,
    sourceFilter,
    { $or: [{ lastVerifyAttemptAt: { $exists: false } }, { lastVerifyAttemptAt: { $lt: cooldown } }] },
    { $or: [{ verifyClaimUntil: { $exists: false } }, { verifyClaimUntil: null }, { verifyClaimUntil: { $lt: now } }] },
  ];
  const claimBy = `${process.pid}:${randomUUID()}`;
  const claimUntil = new Date(now.getTime() + Math.max(2 * 60_000, (options.maxDurationMs ?? 5 * 60_000) + 60_000));
  const candidates: Candidate[] = [];
  const claimNext = async (extra: Record<string, unknown>, sort: Record<string, 1 | -1>, max: number) => {
    while (candidates.length < max) {
      const candidate = await Car.findOneAndUpdate(
        { $and: [...baseFilter, extra, { _id: { $nin: candidates.map((row) => row._id) } }] },
        { $set: { verifyClaimUntil: claimUntil, verifyClaimBy: claimBy } },
        { sort: { ...sort, _id: 1 }, new: true, timestamps: false }
      )
        .select("_id title sourceSite listingUrl externalId price")
        .maxTimeMS(8000)
        .lean<Candidate | null>();
      if (!candidate) break;
      candidates.push(candidate);
    }
  };

  // Önce kullanıcıların açtığı ilanlar, sonra en eskiler. Her satır bulma ve kilitleme atomiktir.
  await claimNext({ verifyPriorityAt: { $exists: true } }, { verifyPriorityAt: 1 }, limit);
  await claimNext({}, { lastVerifiedAt: 1 }, limit);

  const details: SweepDetail[] = [];
  if (candidates.length === 0) return { checked: 0, archived: 0, active: 0, updated: 0, errors: 0, breaker: [], pausedSources: [], details };

  const aliveIds: Types.ObjectId[] = [];
  const attemptedIds: Types.ObjectId[] = [];
  const attemptedByStatus = new Map<"blocked" | "error", Types.ObjectId[]>();
  const refreshListings: ScrapedListing[] = [];
  const refreshDetailByExternalId = new Map<string, SweepDetail>();
  const oldPrices = new Map<string, number>();
  const goneBySource = new Map<string, Array<{ id: Types.ObjectId; reason: string }>>();
  const checkedBySource = new Map<string, number>();
  const aliveBySource = new Map<string, number>();
  let errorCount = 0;
  let updatedCount = 0;
  let processed = 0;
  const started = Date.now();
  const maxDuration = options.maxDurationMs ?? 5 * 60 * 1000;

  const queue = [...candidates];
  const blocks = new BlockStreak(4);
  const blockNotes: string[] = [];
  await Promise.all(
    Array.from({ length: concurrency }).map(async () => {
      while (queue.length > 0 && Date.now() - started < maxDuration) {
        const item = queue.shift();
        if (!item) break;
        const source = item.sourceSite || "bilinmiyor";
        // Engellenen kaynağın kalan ilanları denenmez (denendi damgası da vurulmaz).
        if (blocks.isPaused(source)) continue;
        const timeoutMs = source === "arabam" ? 45000 : 15000;
        let result: VerifyListingResult;
        try {
          result = await Promise.race([
            verifySingleListing(item),
            new Promise<VerifyListingResult>((_, reject) => setTimeout(() => reject(new Error("İlan doğrulama zaman aşımı")), timeoutMs)),
          ]);
        } catch (err: any) {
          result = { status: "error", reason: err?.message || "zaman aşımı" };
        }

        if (blocks.record(source, result.status)) {
          blockNotes.push(`${source}: art arda engel geldi (${result.reason.slice(0, 60)}); bu çalıştırmada ara verildi`);
        }
        checkedBySource.set(source, (checkedBySource.get(source) || 0) + 1);
        const detail: SweepDetail = {
          id: String(item._id),
          title: item.title,
          source,
          status: result.status,
          reason: result.reason,
          checkedAt: new Date(),
        };
        if (result.status === "active") {
          aliveIds.push(item._id);
          aliveBySource.set(source, (aliveBySource.get(source) || 0) + 1);
          if (result.listing) {
            refreshListings.push(result.listing);
            refreshDetailByExternalId.set(result.listing.externalId, detail);
            if (item.price) oldPrices.set(result.listing.externalId, item.price);
          }
        } else if (result.status === "gone" || result.status === "redirected") {
          const list = goneBySource.get(source) || [];
          list.push({ id: item._id, reason: result.reason });
          goneBySource.set(source, list);
        } else {
          attemptedIds.push(item._id);
          const kind = result.status === "blocked" ? "blocked" : "error";
          attemptedByStatus.set(kind, [...(attemptedByStatus.get(kind) || []), item._id]);
          errorCount++;
        }
        details.push(detail);
        processed++;
        options.onProgress?.(processed, candidates.length, [...goneBySource.values()].reduce((s, l) => s + l.length, 0));
      }
    })
  );

  await markSeenAlive(aliveIds, now);
  for (const [kind, ids] of attemptedByStatus) await markVerifyAttempt(ids, now, kind);

  // Canlı çıkan Arabam ilanlarında fiyat/km/açıklama da güncellensin (yalnızca "görüldü" tarihi değil).
  // saveListing zaten değişiklik yoksa yazmıyor, değiştiyse fiyat geçmişine ve favori bildirimine de işliyor.
  if (refreshListings.length > 0) {
    const { saveListing } = await import("@/lib/scraper/run-scrape");
    for (const listing of refreshListings) {
      try {
        const saved = await saveListing(sanitizeRefresh(listing, oldPrices.get(listing.externalId)), { markVerified: true });
        if (saved === "updated" || saved === "reactivated") {
          updatedCount++;
          const detail = refreshDetailByExternalId.get(listing.externalId);
          if (detail) {
            detail.updated = true;
            detail.updatedAt = new Date();
          }
        }
      } catch {
        // ayrıştırılan veri kaydedilemezse canlı/tarih bilgisi yine de yukarıda işlendi
      }
    }
  }

  let archivedCount = 0;
  const breaker: string[] = [...blockNotes];
  for (const [source, gone] of goneBySource) {
    const checked = checkedBySource.get(source) || 0;
    const aliveCount = aliveBySource.get(source) || 0;
    const tripped = source === "arabam" ? arabamBreakerTripped(checked, gone.length, aliveCount) : breakerTripped(checked, gone.length, aliveCount);
    if (tripped) {
      breaker.push(`${source}: ${gone.length}/${checked} ölü göründü, arşivleme durduruldu`);
      await markVerifyAttempt(gone.map((g) => g.id), now, "gone-held");
      continue;
    }
    for (const g of gone) {
      const archivedAt = new Date();
      const archived = await archiveListings([g.id], `${source}: ${g.reason}`, archivedAt);
      archivedCount += archived;
      if (archived > 0) {
        const detail = details.find((row) => row.id === String(g.id));
        if (detail) detail.archivedAt = archivedAt;
      }
    }
  }
  for (const d of details) {
    d.status = statusAfterArchival(d.status, d.archivedAt);
  }

  // Normal bitişte ilanları sonraki makinenin bekletmeden almasına izin ver; süreç çökerse lease dolar.
  await Car.updateMany(
    { verifyClaimBy: claimBy },
    { $unset: { verifyClaimUntil: 1, verifyClaimBy: 1 } },
    { timestamps: false }
  );

  return {
    checked: processed,
    archived: archivedCount,
    active: aliveIds.length,
    updated: updatedCount,
    errors: errorCount,
    breaker,
    pausedSources: blocks.pausedSources,
    details,
  };
}
