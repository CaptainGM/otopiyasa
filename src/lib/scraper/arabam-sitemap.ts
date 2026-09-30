import type { Types } from "mongoose";
import { Car } from "@/models/Car";
import { SourceSyncState } from "@/models/SourceSyncState";

/**
 * ARABAM SITEMAP SENKRONU
 *
 * Arabam, arama motorları için `/sitemap/advert_N.xml` dosyalarında ~1,3 milyon
 * ilan adresi yayınlıyor. Bu dosyalar Cloudflare doğrulamasına takılmıyor ve
 * robots.txt'e uygun (ilan detay/arama sayfaları ise tarayıcı gerektiriyor).
 *
 * ÖLÇÜLEN GERÇEKLER (2026-09-30, gerçek tarayıcıyla örneklem):
 *  - Sitemap EKSİK: DB'de aktif olup sitemap'te bulunmayan 20 ilandan 16'sı hâlâ
 *    yayındaydı. Dolayısıyla "sitemap'te yok" ARŞİV SEBEBİ DEĞİLDİR; yalnızca bu
 *    ilanlar detay taramasında öne alınır (ölü olma ihtimalleri daha yüksek).
 *  - Arşivde olup sitemap'te arşiv tarihinden sonra güncellenmiş görünen 15
 *    ilanın 15'i de yayındaydı (eski doğrulama hatasıyla arşive düşmüşlerdi).
 *    Bunlar "yeniden kontrol et" olarak işaretlenir; detay taraması (evden,
 *    scrape.bat) canlıysa geri açar.
 *  - `lastmod` fiyat değişimini göstermiyor (değişimlerin yarısı lastmod'dan
 *    sonra); bu yüzden fiyat taramasını önceliklendirmekte kullanılmaz,
 *    yalnızca "arşivden sonra güncellenmiş mi" kontrolünde işe yarar.
 */
const INDEX_URL = "https://www.arabam.com/sitemap/sitemap.xml";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
/** Sitemap'in bütün olduğuna güvenmek için beklenen en az ilan adresi. */
const MIN_EXPECTED_ENTRIES = 500_000;
export const SITEMAP_STATE_KEY = "arabam-sitemap";
export const SITEMAP_INTERVAL_MS = 20 * 60 * 60 * 1000;

/** Parça parça gelen XML'den <loc>…/ilan/…/ID</loc><lastmod>…</lastmod> çiftlerini çıkarır. */
export function createSitemapParser(onEntry: (id: string, lastmod: string) => void) {
  const re = /<loc>https:\/\/www\.arabam\.com\/ilan\/[^<]*?\/(\d+)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g;
  let carry = "";
  const scan = (text: string) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) onEntry(m[1], m[2]);
  };
  return {
    push(chunk: string) {
      const text = carry + chunk;
      const cut = text.lastIndexOf("</url>");
      if (cut < 0) {
        carry = text;
        return;
      }
      scan(text.slice(0, cut + 6));
      carry = text.slice(cut + 6);
    },
    end() {
      scan(carry);
      carry = "";
    },
  };
}

async function streamSitemapFile(url: string, onEntry: (id: string, lastmod: string) => void): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Encoding": "gzip", Accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok || !res.body) throw new Error(`${url.split("/").pop()} → HTTP ${res.status}`);
  const parser = createSitemapParser(onEntry);
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  parser.end();
}

export interface SitemapSyncResult {
  status: "ok" | "failed";
  message: string;
  files: number;
  entries: number;
  activePresent: number;
  activeMissing: number;
  newlyMissing: number;
  recheckFlagged: number;
  durationMs: number;
}

function dayOf(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

async function inChunks<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size));
}

export async function syncArabamSitemap(options: { log?: (msg: string) => void } = {}): Promise<SitemapSyncResult> {
  const log = options.log || (() => {});
  const started = Date.now();
  const now = new Date();
  const empty = { files: 0, entries: 0, activePresent: 0, activeMissing: 0, newlyMissing: 0, recheckFlagged: 0 };

  const finish = async (result: SitemapSyncResult) => {
    await SourceSyncState.findOneAndUpdate(
      { source: SITEMAP_STATE_KEY },
      {
        $set: {
          lastRunAt: now,
          ...(result.status === "ok" ? { lastSuccessAt: now } : {}),
          lastStatus: result.status,
          lastMessage: result.message,
          complete: result.status === "ok",
          seen: result.activePresent,
          markedMissing: result.newlyMissing,
          updated: result.recheckFlagged,
          durationMs: result.durationMs,
        },
      },
      { upsert: true }
    ).catch(() => {});
    log(`${result.status === "ok" ? "✅" : "⚠️"} [ARABAM SITEMAP] ${result.message}`);
    return result;
  };

  // 1) Sitemap dizini
  let files: string[] = [];
  try {
    const res = await fetch(INDEX_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      return finish({ ...empty, status: "failed", message: `Sitemap dizini alınamadı (HTTP ${res.status}); bu ağdan erişim engelli olabilir.`, durationMs: Date.now() - started });
    }
    const text = await res.text();
    files = [...text.matchAll(/<loc>(https:\/\/www\.arabam\.com\/sitemap\/advert_\d+\.xml)<\/loc>/g)].map((m) => m[1]);
  } catch (err) {
    return finish({ ...empty, status: "failed", message: `Sitemap dizini alınamadı: ${err instanceof Error ? err.message : err}`, durationMs: Date.now() - started });
  }
  if (files.length === 0) {
    return finish({ ...empty, status: "failed", message: "Sitemap dizininde ilan dosyası bulunamadı (yapı değişmiş olabilir).", durationMs: Date.now() - started });
  }

  // 2) Bizdeki Arabam kayıtları (yalnızca eşleşenler bellekte tutulur)
  type Row = { _id: Types.ObjectId; externalId: string; status: string; removedAt?: Date; updatedAt?: Date; sitemapMissingSince?: Date };
  const rows = await Car.find({ sourceSite: "arabam" })
    .select("_id externalId status removedAt updatedAt sitemapMissingSince")
    .lean<Row[]>();
  const byId = new Map<string, Row>();
  for (const r of rows) {
    const id = String(r.externalId || "").replace(/^arabam-/, "");
    if (id) byId.set(id, r);
  }

  // 3) Dosyaları akış olarak oku
  const lastmodById = new Map<string, string>();
  let entries = 0;
  try {
    for (const [i, file] of files.entries()) {
      await streamSitemapFile(file, (id, lastmod) => {
        entries++;
        if (byId.has(id)) lastmodById.set(id, lastmod);
      });
      log(`   📄 Sitemap ${i + 1}/${files.length} okundu (${entries.toLocaleString("tr-TR")} adres)`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    return finish({ ...empty, files: files.length, entries, status: "failed", message: `Sitemap dosyası okunamadı, hiçbir kayıt değiştirilmedi: ${err instanceof Error ? err.message : err}`, durationMs: Date.now() - started });
  }
  if (entries < MIN_EXPECTED_ENTRIES) {
    return finish({ ...empty, files: files.length, entries, status: "failed", message: `Sitemap beklenenden küçük (${entries} adres); hiçbir kayıt değiştirilmedi.`, durationMs: Date.now() - started });
  }

  // 4) İşaretleri güncelle (updatedAt'e dokunmadan)
  const presentActiveFlagged: Types.ObjectId[] = [];
  const absentActiveUnflagged: Types.ObjectId[] = [];
  const recheck: Types.ObjectId[] = [];
  let activePresent = 0;
  let activeMissing = 0;

  for (const [id, row] of byId) {
    const lastmod = lastmodById.get(id);
    if (row.status === "active") {
      if (lastmod) {
        activePresent++;
        if (row.sitemapMissingSince) presentActiveFlagged.push(row._id);
      } else {
        activeMissing++;
        if (!row.sitemapMissingSince) absentActiveUnflagged.push(row._id);
      }
    } else if (row.status === "removed" && lastmod) {
      const removedDay = dayOf(row.removedAt || row.updatedAt || new Date(0));
      if (lastmod > removedDay) recheck.push(row._id);
    }
  }

  const opts = { timestamps: false } as const;
  await inChunks(presentActiveFlagged, 5000, (ids) => Car.updateMany({ _id: { $in: ids } }, { $unset: { sitemapMissingSince: 1 } }, opts));
  await inChunks(absentActiveUnflagged, 5000, (ids) => Car.updateMany({ _id: { $in: ids } }, { $set: { sitemapMissingSince: now } }, opts));
  await inChunks(recheck, 5000, (ids) => Car.updateMany({ _id: { $in: ids } }, { $set: { needsRecheck: true } }, opts));

  return finish({
    status: "ok",
    files: files.length,
    entries,
    activePresent,
    activeMissing,
    newlyMissing: absentActiveUnflagged.length,
    recheckFlagged: recheck.length,
    durationMs: Date.now() - started,
    message:
      `${files.length} dosya, ${entries.toLocaleString("tr-TR")} adres okundu. Aktif ilanlarımızdan ${activePresent} sitemap'te var, ` +
      `${activeMissing} yok (detay taramasında öne alındı; tek başına arşiv sebebi değil). ` +
      `Arşivde olup yayında görünen ${recheck.length} ilan yeniden kontrol için işaretlendi.`,
  });
}

/** Sitemap senkronunun sırası geldi mi? */
export async function isSitemapSyncDue(now = new Date()): Promise<boolean> {
  const state = await SourceSyncState.findOne({ source: SITEMAP_STATE_KEY }).select("lastRunAt").lean<{ lastRunAt?: Date } | null>();
  if (!state?.lastRunAt) return true;
  return now.getTime() - new Date(state.lastRunAt).getTime() >= SITEMAP_INTERVAL_MS;
}
