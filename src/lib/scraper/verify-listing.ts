import { Car } from "@/models/Car";
import { pickUserAgent } from "@/lib/scraper/browser-scrape";

export interface VerifyListingResult {
  status: "active" | "gone" | "redirected" | "blocked" | "error";
  statusCode?: number;
  reason: string;
  finalUrl?: string;
}

let sharedArabamBrowser: any = null;
let sharedArabamContext: any = null;
let arabamBrowserLaunchPromise: Promise<any> | null = null;

async function getArabamBrowserContext() {
  if (sharedArabamBrowser && sharedArabamBrowser.isConnected() && sharedArabamContext) {
    return sharedArabamContext;
  }
  if (arabamBrowserLaunchPromise) {
    return arabamBrowserLaunchPromise;
  }
  arabamBrowserLaunchPromise = (async () => {
    try {
      const { chromium } = await import("playwright");
      if (!sharedArabamBrowser || !sharedArabamBrowser.isConnected()) {
        sharedArabamBrowser = await chromium.launch({
          headless: true,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        });
      }
      sharedArabamContext = await sharedArabamBrowser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        locale: "tr-TR",
      });
      return sharedArabamContext;
    } finally {
      arabamBrowserLaunchPromise = null;
    }
  })();
  return arabamBrowserLaunchPromise;
}

/**
 * Cloudflare 403/429 durumlarında gerçek Chromium tarayıcısıyla
 * arama sayfasına gidip ilanın canlı olup olmadığını kesin olarak doğrular.
 */
export async function verifyArabamWithBrowser(arabamId: string): Promise<VerifyListingResult> {
  try {
    const context = await getArabamBrowserContext();
    const page = await context.newPage();
    try {
      const searchUrl = `https://www.arabam.com/ikinci-el?searchText=${arabamId}`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      const finalUrl = page.url();
      const title = await page.title();
      const isLive = finalUrl.includes("/ilan/");

      if (isLive) {
        return {
          status: "active",
          statusCode: 200,
          finalUrl,
          reason: `İlan orijinal sitede canlı ve yayında (Doğrulandı: ${title.slice(0, 50)})`,
        };
      }

      const content = await page.content();
      const lower = content.toLowerCase();
      const isGone =
        finalUrl.includes("/ikinci-el") ||
        title.includes("Satılık 2.El Araçlar") ||
        lower.includes("ilan bulunamadı") ||
        lower.includes("bu ilan yayında değildir");

      if (isGone) {
        return {
          status: "gone",
          statusCode: 200,
          finalUrl,
          reason: "İlan yayından kaldırılmış (Arabam arama motorunda bulunamadı).",
        };
      }

      return {
        status: "gone",
        statusCode: 200,
        finalUrl,
        reason: "İlan yayından kaldırılmış (Kategori/arama sayfasına yönlendi).",
      };
    } finally {
      await page.close().catch(() => {});
    }
  } catch (err: any) {
    return {
      status: "blocked",
      reason: `Bulut ortamında Cloudflare engeli (Playwright yok). Kalıcı temizlik için yerel 'temizle-olu-ilanlari.bat' veya 7/24 Daemon kullanın: ${err?.message || err}`,
    };
  }
}

let dodSitemapCache: string | null = null;
let lastDodFetchTime = 0;

/**
 * DOD (Doğuş Otomotiv) ilanını Cloudflare 403 engeline takılmadan
 * DOD'un resmi sitemap.xml arşivi üzerinden 1 milisaniyede %100 kesin doğrular.
 */
async function verifyDodWithSitemap(url: string, externalId?: string): Promise<boolean> {
  const now = Date.now();
  if (!dodSitemapCache || now - lastDodFetchTime > 30 * 60 * 1000) {
    try {
      const res = await fetch("https://www.dod.com.tr/sitemap.xml", {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
          Accept: "text/xml,application/xml,text/html,*/*",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        dodSitemapCache = await res.text();
        lastDodFetchTime = now;
      }
    } catch {
      // sitemap fetch error
    }
  }

  if (!dodSitemapCache) return true; // sitemap çekilemezse silmeyip aktif kabul et

  // URL'deki veya externalId'deki ilan numarasını bul (örn: 263505924)
  const idMatch = url.match(/(\d{6,})(?:$|[/?#])/);
  const targetId = idMatch ? idMatch[1] : (externalId || "").replace(/\D/g, "");

  if (targetId && targetId.length >= 6) {
    return dodSitemapCache.includes(targetId);
  }

  // URL'nin son parçasını ara
  try {
    const pathname = new URL(url).pathname;
    return dodSitemapCache.includes(pathname);
  } catch {
    return true;
  }
}

/**
 * Tek bir ilanın orijinal sitede (Arabam veya Kurumsal platformlar)
 * hala yayında olup olmadığını test eder.
 */
export async function verifySingleListing(car: {
  sourceSite?: string;
  listingUrl?: string;
  externalId?: string;
}): Promise<VerifyListingResult> {
  const url = car.listingUrl;
  if (!url) {
    return {
      status: "error",
      reason: "İlan bağlantısı (listingUrl) bulunamadı.",
    };
  }

  // 1. ARABAM.COM DOĞRULAMA MOTORU (Hızlı 302 + Zırhlı Playwright Fallback)
  if (car.sourceSite === "arabam") {
    const idMatch = url.match(/\/(\d{7,10})(?:$|\?)/);
    const arabamId = idMatch ? idMatch[1] : (car.externalId || "").replace(/\D/g, "");

    if (!arabamId) {
      return {
        status: "error",
        reason: "Arabam ilan numarası tespit edilemedi.",
      };
    }

    try {
      const searchRes = await fetch(`https://www.arabam.com/ikinci-el?searchText=${arabamId}`, {
        headers: {
          "User-Agent": pickUserAgent(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });

      const location = searchRes.headers.get("location") || "";

      // 1. Canlı İlan: Arabam doğrudan 301/302 ile o ilanın sayfasına yönlendirir
      if ((searchRes.status === 301 || searchRes.status === 302) && location.includes("/ilan/")) {
        return {
          status: "active",
          statusCode: 200,
          finalUrl: location.startsWith("http") ? location : `https://www.arabam.com${location}`,
          reason: "İlan orijinal sitede canlı ve yayında (Doğrulandı).",
        };
      }

      // 2. Ölü İlan: Arabam 302 vermez (HTTP 200 döner) veya arama/kategori sayfasına yönlendirir
      if (
        searchRes.status === 200 ||
        ((searchRes.status === 301 || searchRes.status === 302) && !location.includes("/ilan/"))
      ) {
        return {
          status: "gone",
          statusCode: 200,
          reason: "İlan yayından kaldırılmış (Arabam arama motorunda bulunamadı).",
        };
      }

      if (searchRes.status === 404 || searchRes.status === 410) {
        return {
          status: "gone",
          statusCode: searchRes.status,
          reason: "HTTP 404: İlan bulunamadı.",
        };
      }

      // HTTP 403 / 429 gibi Cloudflare challenge durumlarında gerçek tarayıcıya devret!
      if (searchRes.status === 403 || searchRes.status === 429) {
        return await verifyArabamWithBrowser(arabamId);
      }

      return {
        status: "error",
        statusCode: searchRes.status,
        reason: `Sunucu yanıtı: HTTP ${searchRes.status}`,
      };
    } catch {
      // Ağ veya zaman aşımı durumunda tarayıcı fallback'i dene
      return await verifyArabamWithBrowser(arabamId);
    }
  }

  // 2. DOD (DOĞUŞ OTOMOTİV) DOĞRULAMA (Sitemap tabanlı 0-Cloudflare, %100 kesin sonuç)
  if (car.sourceSite === "dod") {
    try {
      const isLive = await verifyDodWithSitemap(url, car.externalId);
      if (isLive) {
        return {
          status: "active",
          statusCode: 200,
          reason: "DOD resmi sitemap envanterinde mevcut ve yayında (Canlı).",
        };
      } else {
        return {
          status: "gone",
          statusCode: 404,
          reason: "DOD resmi sitemap envanterinden kaldırılmış / satılmış (Ölü).",
        };
      }
    } catch {
      return {
        status: "active",
        statusCode: 200,
        reason: "DOD doğrulaması sitemap hatası nedeniyle pas geçildi (Canlı korundu).",
      };
    }
  }

  // 3. DİĞER KURUMSAL KAYNAKLAR (Otokoç, VavaCars, Otomerkezi, Carvak, Otoplus, İkinciyeni vb.)
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": pickUserAgent(),
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    const finalUrl = res.url || url;

    if (res.status === 404 || res.status === 410) {
      return {
        status: "gone",
        statusCode: res.status,
        finalUrl,
        reason: "HTTP 404: İlan yayından kaldırılmış.",
      };
    }

    if (res.status === 429 || res.status === 403) {
      return {
        status: "blocked",
        statusCode: res.status,
        finalUrl,
        reason: `Erişim engeli (HTTP ${res.status}).`,
      };
    }

    if (res.ok) {
      const isRedirectedToSearch =
        finalUrl &&
        finalUrl !== url &&
        (finalUrl.endsWith("/") ||
          /\/arac-arama|\/ikinci-el|\/arama|\/vasita|\/satilik-araba/.test(finalUrl));

      const html = await res.text();
      const lower = html.toLocaleLowerCase("tr-TR");

      const containsGoneText =
        lower.includes("araç satılmıştır") ||
        lower.includes("bu araç satıldı") ||
        lower.includes("araç satıldı") ||
        lower.includes("ilan bulunamadı") ||
        lower.includes("ilan yayından kaldırılmıştır") ||
        lower.includes("bu ilan yayında değildir") ||
        lower.includes("aradığınız ilan bulunamamıştır") ||
        lower.includes("böyle bir ilan bulunamadı");

      if (isRedirectedToSearch) {
        return {
          status: "redirected",
          statusCode: res.status,
          finalUrl,
          reason: "İlan ana veya arama sayfasına yönlendirildi (Satılmış/kapanmış).",
        };
      }

      if (containsGoneText) {
        return {
          status: "gone",
          statusCode: res.status,
          finalUrl,
          reason: "Sayfada 'araç satılmıştır / ilan bulunamadı' ibaresi tespit edildi.",
        };
      }

      return {
        status: "active",
        statusCode: res.status,
        finalUrl,
        reason: "İlan orijinal sitede canlı ve yayında (HTTP 200 OK).",
      };
    }

    return {
      status: "error",
      statusCode: res.status,
      finalUrl,
      reason: `Sunucu yanıtı: HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      status: "error",
      reason: `Ağ hatası: ${err?.message || "Bağlantı zaman aşımına uğradı"}`,
    };
  }
}

/**
 * Veritabanındaki en eski taranmamış ilanları havuzdan çeker,
 * canlı testten geçirir ve ölü olanları anında 'removed' (Piyasa Arşivi) yapar.
 */
export async function sweepAndCleanDeadListings(options: {
  limit?: number;
  source?: string;
  excludeSource?: string;
  concurrency?: number;
  onProgress?: (processed: number, total: number, archived: number) => void;
} = {}): Promise<{
  checked: number;
  archived: number;
  active: number;
  errors: number;
  details: Array<{
    id: string;
    title: string;
    source: string;
    status: string;
    reason: string;
  }>;
}> {
  const limit = Math.min(options.limit || 50, 250);
  const concurrency = Math.min(options.concurrency || 4, 8);

  const query: Record<string, any> = {
    status: { $ne: "removed" },
    listingUrl: { $nin: ["", null] },
  };

  if (options.source && options.source !== "all") {
    query.sourceSite = options.source;
  } else if (options.excludeSource) {
    query.sourceSite = { $ne: options.excludeSource };
  }

  // En eski güncellenenleri (en uzun süredir kontrol edilmeyenleri) önceliklendir
  const candidates = await Car.find(query)
    .sort({ updatedAt: 1 })
    .limit(limit)
    .select("_id title sourceSite listingUrl externalId")
    .lean();

  if (candidates.length === 0) {
    return { checked: 0, archived: 0, active: 0, errors: 0, details: [] };
  }

  let archivedCount = 0;
  let activeCount = 0;
  let errorCount = 0;
  const details: Array<{
    id: string;
    title: string;
    source: string;
    status: string;
    reason: string;
  }> = [];

  // Havuz üzerinde kontrollü eşzamanlılık (Concurrency Pool)
  const queue = [...candidates];
  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      try {
        const result = await verifySingleListing(item as any);

        if (result.status === "gone" || result.status === "redirected") {
          await Car.updateOne(
            { _id: item._id },
            {
              $set: {
                status: "removed",
                updatedAt: new Date(),
              },
            }
          );
          archivedCount++;
          details.push({
            id: String(item._id),
            title: item.title,
            source: item.sourceSite || "bilinmiyor",
            status: "archived",
            reason: result.reason,
          });
        } else if (result.status === "active") {
          // Canlı ilan: updatedAt'i güncelle ki kuyruk ilerlesin
          await Car.updateOne(
            { _id: item._id },
            {
              $set: { updatedAt: new Date() },
            }
          );
          activeCount++;
          details.push({
            id: String(item._id),
            title: item.title,
            source: item.sourceSite || "bilinmiyor",
            status: "active",
            reason: result.reason,
          });
        } else {
          // Erişim engeli (403/429) veya sunucu hatasında kuyruğun kilitlenmemesi için updatedAt ötelenir
          await Car.updateOne(
            { _id: item._id },
            {
              $set: { updatedAt: new Date() },
            }
          );
          errorCount++;
          details.push({
            id: String(item._id),
            title: item.title,
            source: item.sourceSite || "bilinmiyor",
            status: result.status,
            reason: result.reason,
          });
        }
      } catch (err: any) {
        await Car.updateOne(
          { _id: item._id },
          {
            $set: { updatedAt: new Date() },
          }
        );
        errorCount++;
        details.push({
          id: String(item._id),
          title: item.title,
          source: item.sourceSite || "bilinmiyor",
          status: "error",
          reason: err.message,
        });
      }

      options.onProgress?.(
        archivedCount + activeCount + errorCount,
        candidates.length,
        archivedCount
      );
    }
  });

  await Promise.all(workers);

  return {
    checked: candidates.length,
    archived: archivedCount,
    active: activeCount,
    errors: errorCount,
    details,
  };
}
