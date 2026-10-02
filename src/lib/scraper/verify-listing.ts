import type { Types } from "mongoose";
import { Car } from "@/models/Car";
import { fetchPageWithBrowser, isCloudflareChallenge, isListingGone, pickUserAgent } from "@/lib/scraper/browser-scrape";
import {
  LIFECYCLE,
  SCRAPED_SOURCE_FILTER,
  archiveListings,
  breakerTripped,
  markSeenAlive,
  markVerifyAttempt,
} from "@/lib/scraper/listing-lifecycle";

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

/**
 * Otokoç, satılan ilanın sayfasını HTTP 200 ile "404 | Sayfa Bulunamadı" (soft 404)
 * olarak döndürüyor; eski doğrulayıcı bunları "canlı" sayıyordu (en eski 40 aktif
 * ilanın 27'si böyleydi, DB'deki 1.657 aktif ilanın yalnızca ~1.250'si sitede).
 * DİKKAT: "404 | Sayfa Bulunamadı" metni CANLI sayfalarda da gömülü (Next.js not-found
 * bileşeni), bu yüzden tek başına ayırt edici değildir. Belirleyici olan, gerçek
 * ilan verisinin (Product/Car ld+json) bulunup bulunmamasıdır.
 */
export function classifyOtokocHtml(html: string): "live" | "gone" | "unknown" {
  if (/"@type"\s*:\s*"(Product|Car|Vehicle)"/.test(html)) return "live";
  if (/404 \| Sayfa Bulunamad/.test(html)) return "gone";
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

let arabamGate: Promise<void> = Promise.resolve();

/** Sıra beklenir; sonraki çağrı en az min..min+spread ms sonra başlar (işçi sayısından bağımsız). */
async function waitForArabamTurn(): Promise<void> {
  const previous = arabamGate;
  let release!: () => void;
  arabamGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  setTimeout(release, ARABAM_PAGE_GAP_MS.min + Math.random() * ARABAM_PAGE_GAP_MS.spread);
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
    if (/\/ilan\//.test(page.finalUrl) && /"@type"\s*:\s*"Car"/.test(page.html)) {
      return { status: "active", statusCode: page.status, finalUrl: page.finalUrl, reason: "İlan sayfası canlı (tarayıcıyla doğrulandı)." };
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
      if (kind === "gone") {
        return { status: "gone", statusCode: res.status, finalUrl, reason: "Otokoç ilan sayfası '404 | Sayfa Bulunamadı' döndürüyor (satılmış)." };
      }
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

type SweepDetail = { id: string; title: string; source: string; status: string; reason: string };

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

  const candidates = await Car.find({
    $and: [
      { status: "active", listingUrl: { $nin: ["", null] } },
      SCRAPED_SOURCE_FILTER,
      sourceFilter,
      { $or: [{ lastVerifyAttemptAt: { $exists: false } }, { lastVerifyAttemptAt: { $lt: cooldown } }] },
    ],
  })
    .sort({ lastVerifiedAt: 1 })
    .limit(limit)
    .select("_id title sourceSite listingUrl externalId")
    .maxTimeMS(8000)
    .lean<Array<{ _id: Types.ObjectId; title: string; sourceSite: string; listingUrl: string; externalId?: string }>>();

  const details: SweepDetail[] = [];
  if (candidates.length === 0) return { checked: 0, archived: 0, active: 0, errors: 0, breaker: [], pausedSources: [], details };

  const aliveIds: Types.ObjectId[] = [];
  const attemptedIds: Types.ObjectId[] = [];
  const goneBySource = new Map<string, Array<{ id: Types.ObjectId; reason: string }>>();
  const checkedBySource = new Map<string, number>();
  const aliveBySource = new Map<string, number>();
  let errorCount = 0;
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
        if (result.status === "active") {
          aliveIds.push(item._id);
          aliveBySource.set(source, (aliveBySource.get(source) || 0) + 1);
        } else if (result.status === "gone" || result.status === "redirected") {
          const list = goneBySource.get(source) || [];
          list.push({ id: item._id, reason: result.reason });
          goneBySource.set(source, list);
        } else {
          attemptedIds.push(item._id);
          errorCount++;
        }
        details.push({ id: String(item._id), title: item.title, source, status: result.status, reason: result.reason });
        processed++;
        options.onProgress?.(processed, candidates.length, [...goneBySource.values()].reduce((s, l) => s + l.length, 0));
      }
    })
  );

  await markSeenAlive(aliveIds, now);
  await markVerifyAttempt(attemptedIds, now);

  let archivedCount = 0;
  const breaker: string[] = [...blockNotes];
  for (const [source, gone] of goneBySource) {
    const checked = checkedBySource.get(source) || 0;
    if (breakerTripped(checked, gone.length, aliveBySource.get(source) || 0)) {
      breaker.push(`${source}: ${gone.length}/${checked} ölü göründü, arşivleme durduruldu`);
      await markVerifyAttempt(gone.map((g) => g.id), now);
      continue;
    }
    for (const g of gone) {
      archivedCount += await archiveListings([g.id], `${source}: ${g.reason}`, now);
    }
  }
  for (const d of details) {
    if ((d.status === "gone" || d.status === "redirected") && !breaker.some((b) => b.startsWith(`${d.source}:`))) {
      d.status = "archived";
    }
  }

  return {
    checked: processed,
    archived: archivedCount,
    active: aliveIds.length,
    errors: errorCount,
    breaker,
    pausedSources: blocks.pausedSources,
    details,
  };
}
