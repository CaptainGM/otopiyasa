// EKSİK DETAY TARAMASI: aktif ilanları tarar, hangi bilginin kaç ilanda eksik olduğunu raporlar
// ve ilan sayfası okunabilen kaynaklarda (Arabam, Otokoç, Otoplus) eksikleri tamamlar.
//   npx tsx scripts/complete-details.ts            → rapor + tamamlama (tüm adaylar)
//   npx tsx scripts/complete-details.ts 500        → en fazla 500 ilan tamamla
//   npx tsx scripts/complete-details.ts --rapor    → yalnızca rapor
// Ev ağından çalıştırılmalı (Arabam yurt dışı IP'yi engelliyor). Ctrl+C ile güvenle durdurulur.
import { loadEnv } from "./load-env";

loadEnv();
process.env.SCRAPE_MIN_INTERVAL_MS = process.env.SCRAPE_MIN_INTERVAL_MS || "1200";

const reportOnly = process.argv.includes("--rapor");
const limitArg = Number(process.argv.find((a) => /^\d+$/.test(a)));
const LIMIT = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : Infinity;
const DETAIL_SOURCES = ["arabam", "otokoc", "otoplus", "carvak", "dod", "otomerkezi"];
/** Bir kez okunup yine eksik kalan ilan (kaynak o bilgiyi vermiyor) bu süre dolmadan tekrar denenmez. */
const RETRY_AFTER_DAYS = 14;
const ARABAM_CONCURRENCY = 2;

/** Liste sayfasından gelen, satıcının yazmadığı şablon açıklamalar. */
const TEMPLATE_DESC = /(- Arabam ilanı$|Kurumsal Garantili İkinci El\. )/;

// Her alan için "eksik" koşulu (Mongo sorgusu) ve rapordaki adı.
const FIELDS: Array<{ key: string; label: string; query: Record<string, unknown> }> = [
  { key: "foto", label: "Fotoğraf (≤1)", query: { "images.1": { $exists: false } } },
  { key: "aciklama", label: "Açıklama", query: { $or: [{ description: { $in: ["", null] } }, { description: TEMPLATE_DESC }] } },
  { key: "km", label: "Kilometre", query: { $or: [{ mileage: { $lte: 0 } }, { mileage: null }] } },
  { key: "fiyat", label: "Fiyat", query: { $or: [{ price: { $lte: 0 } }, { price: null }] } },
  // Kurumsal kaynaklar açık adres vermiyor (yalnızca il/bayi); boş adres eksik sayılırsa bu ilanlar hiç "tamam" olmaz.
  { key: "konum", label: "Konum (şehir)", query: { city: { $in: ["", null, "Türkiye"] } } },
  {
    key: "hasar",
    label: "Hasar/boya",
    query: { $and: [{ $or: [{ damageParts: { $exists: false } }, { damageParts: { $size: 0 } }] }, { paintChange: { $in: ["", null] } }] },
  },
  { key: "motor", label: "Motor hacmi", query: { "features.engineSize": { $in: [null, 0] } } },
  { key: "beygir", label: "Motor gücü (hp)", query: { "features.horsepower": { $in: [null, 0] } } },
  { key: "okunmamis", label: "İlan sayfası hiç okunmamış", query: { detailCheckedAt: { $exists: false } } },
];

/** Tamamlanmaya aday: çekirdek bilgilerden biri eksik (motor/beygir tek başına aday yapmaz, çoğu ilanda kaynakta yok). */
const CORE_MISSING = { $or: FIELDS.filter((f) => ["foto", "aciklama", "km", "konum", "hasar"].includes(f.key)).map((f) => f.query) };

async function main() {
  const { connectDB } = await import("@/lib/mongodb");
  const { Car } = await import("@/models/Car");
  const { default: mongoose } = await import("mongoose");
  await connectDB();

  const active = { status: "active" };

  async function report(title: string) {
    const sources: string[] = (await Car.distinct("sourceSite", active)).sort();
    const rows: Array<Record<string, number | string>> = [];
    for (const source of sources) {
      const base = { ...active, sourceSite: source };
      const counts = await Promise.all([
        Car.countDocuments(base),
        ...FIELDS.map((f) => Car.countDocuments({ ...base, ...f.query })),
        Car.countDocuments({ ...base, ...CORE_MISSING }),
      ]);
      const row: Record<string, number | string> = { kaynak: source, toplam: counts[0], eksik: counts[counts.length - 1] };
      FIELDS.forEach((f, i) => (row[f.key] = counts[i + 1]));
      rows.push(row);
    }
    const n = (v: number | string) => (typeof v === "number" ? v.toLocaleString("tr-TR") : v);
    console.log(`\n${title}`);
    console.log("─".repeat(78));
    console.log(`${"Kaynak".padEnd(12)}${"Aktif".padStart(8)}${"Eksik*".padStart(9)}   ${FIELDS.map((f) => f.key).join(" / ")}`);
    for (const r of rows) {
      console.log(`${String(r.kaynak).padEnd(12)}${n(r.toplam).padStart(8)}${n(r.eksik).padStart(9)}   ${FIELDS.map((f) => n(r[f.key])).join(" / ")}`);
    }
    const total = rows.reduce((s, r) => s + (r.eksik as number), 0);
    console.log("─".repeat(78));
    console.log(`* Eksik: fotoğraf, açıklama, km, konum veya hasar/boya bilgisinden en az biri yok. Toplam: ${total.toLocaleString("tr-TR")} ilan`);
    console.log(`  Sütunlar: ${FIELDS.map((f) => `${f.key} = ${f.label}`).join(", ")}`);
    return total;
  }

  await report("📋 EKSİK DETAY RAPORU (aktif ilanlar)");
  if (reportOnly) {
    await mongoose.disconnect();
    return;
  }

  const retryBefore = new Date(Date.now() - RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await Car.find({
    ...active,
    sourceSite: { $in: DETAIL_SOURCES },
    listingUrl: { $nin: ["", null] },
    ...CORE_MISSING,
    $and: [{ $or: [{ detailCheckedAt: { $exists: false } }, { detailCheckedAt: { $lt: retryBefore } }] }],
  })
    .sort({ detailCheckedAt: 1, createdAt: -1 })
    .limit(Number.isFinite(LIMIT) ? LIMIT : 0)
    .select("_id sourceSite listingUrl price city address features")
    .lean<Array<{ _id: unknown; sourceSite: string; listingUrl: string; price: number; city?: string; address?: string; features?: Record<string, string> }>>();

  const bySource = (s: string) => candidates.filter((c) => c.sourceSite === s);
  console.log(
    `\n🔧 Tamamlanacak: ${candidates.length.toLocaleString("tr-TR")} ilan ` +
      `(Arabam ${bySource("arabam").length}, Otokoç ${bySource("otokoc").length}, Otoplus ${bySource("otoplus").length}, ` +
      `Carvak ${bySource("carvak").length}, DOD ${bySource("dod").length}, Otomerkezi ${bySource("otomerkezi").length}).` +
      `\n   Son ${RETRY_AFTER_DAYS} günde okunup yine eksik kalanlar atlandı (kaynak o bilgiyi vermiyor).` +
      `\n   VavaCars ve İkinciyeni ilan detayı sunmadığı için envanter senkronuyla güncellenir.\n`
  );

  let stopping = false;
  process.on("SIGINT", () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log("\n\n🛑 Durduruluyor; işlenen ilanlar kaydedildi.");
  });

  // Yönetim panelindeki denetim kayıtlarında diğer terminal işleri gibi görünsün.
  const { ManualScrapeLog } = await import("@/models/ManualScrapeLog");
  const runStarted = Date.now();
  const logDoc =
    candidates.length > 0
      ? await ManualScrapeLog.create({
          actor: "Terminal (scrape.bat - Eksik Detay)",
          source: "all",
          label: "Eksik Detay Tamamlama (galeri, açıklama, hasar)",
          status: "partial",
          message: `${candidates.length.toLocaleString("tr-TR")} eksik ilan tamamlanıyor.`,
        }).catch(() => null)
      : null;
  const perSource: Record<string, { scanned: number; updated?: number; deleted?: number }> = {};

  // Kurumsal kaynaklar: 50'lik partiler, satılmışlar arşivlenir.
  const { runDetailBackfill } = await import("@/lib/scraper/enrich-detail");
  const corporate = candidates.filter((c) => c.sourceSite !== "arabam").map((c) => c._id);
  const corporateStats = { checked: 0, enriched: 0, archived: 0, images: 0 };
  for (let i = 0; i < corporate.length && !stopping; i += 50) {
    const r = await runDetailBackfill(50, { ids: corporate.slice(i, i + 50), log: (m) => console.log(`   ${m}`) });
    corporateStats.checked += r.checked;
    corporateStats.enriched += r.enriched;
    corporateStats.archived += r.archived;
    corporateStats.images += r.imagesAdded;
  }
  for (const source of new Set(candidates.filter((c) => c.sourceSite !== "arabam").map((c) => c.sourceSite))) {
    perSource[source] = { scanned: bySource(source).length };
  }

  // Arabam: ilan sayfası okunur; kaldırılmışsa arşivlenir.
  const { fetchPageHtml, isListingGone, parseArabamDetailHtml } = await import("@/lib/scraper/browser-scrape");
  const { archiveListings } = await import("@/lib/scraper/listing-lifecycle");
  const { arabamDetailSet } = await import("@/lib/scraper/enrich-arabam");
  const queue = bySource("arabam");
  const stats = { done: 0, filled: 0, archived: 0, failed: 0 };
  const started = Date.now();

  async function worker() {
    while (queue.length > 0 && !stopping) {
      const car = queue.shift()!;
      try {
        let page = await fetchPageHtml(car.listingUrl);
        if (page.status === 429) {
          process.stdout.write("\n   ⏳ Hız sınırı; 30 sn bekleniyor...");
          await new Promise((r) => setTimeout(r, 30_000));
          page = await fetchPageHtml(car.listingUrl);
        }
        if (page.status === 404 || page.status === 410 || (page.ok && isListingGone(page.html, page.finalUrl))) {
          stats.archived += await archiveListings([car._id as string], `arabam: ${page.ok ? "ilan sayfası kaldırılmış" : `HTTP ${page.status}`}`);
        } else {
          const listing = page.ok ? parseArabamDetailHtml(page.html, car.listingUrl) : null;
          if (listing) {
            const priceChanged = listing.price > 0 && listing.price !== car.price;
            await Car.updateOne(
              { _id: car._id },
              {
                ...(priceChanged ? { $push: { priceHistory: { price: listing.price, recordedAt: new Date() } } } : {}),
                $set: {
                  ...arabamDetailSet(listing, car),
                  ...(priceChanged ? { price: listing.price } : {}),
                  ...(listing.mileage > 0 ? { mileage: listing.mileage } : {}),
                  lastVerifiedAt: new Date(),
                  lastVerifyAttemptAt: new Date(),
                },
                $unset: { missingSince: 1, missingChecks: 1 },
              },
              { timestamps: priceChanged }
            );
            stats.filled++;
          } else {
            stats.failed++;
            await Car.updateOne({ _id: car._id }, { $set: { lastVerifyAttemptAt: new Date() } }, { timestamps: false });
          }
        }
      } catch {
        stats.failed++;
      }
      stats.done++;
      const speed = stats.done / Math.max(1, (Date.now() - started) / 1000);
      process.stdout.write(
        `\r   [Arabam ${stats.done}/${stats.done + queue.length}] ✨ tamamlanan ${stats.filled} | 🗑️ arşivlenen ${stats.archived} | okunamayan ${stats.failed} | ${speed.toFixed(1)} ilan/sn   `
      );
    }
  }
  if (queue.length > 0) await Promise.all(Array.from({ length: ARABAM_CONCURRENCY }, worker));

  if (logDoc) {
    if (stats.done > 0) perSource.arabam = { scanned: stats.done, updated: stats.filled, deleted: stats.archived };
    const scanned = corporateStats.checked + stats.done;
    await ManualScrapeLog.updateOne(
      { _id: logDoc._id },
      {
        $set: {
          scanned,
          updated: corporateStats.enriched + stats.filled,
          deleted: corporateStats.archived + stats.archived,
          durationSeconds: Math.max(1, Math.round((Date.now() - runStarted) / 1000)),
          status: stopping ? "partial" : "success",
          bySource: perSource,
          message:
            `${scanned.toLocaleString("tr-TR")} ilan okundu: ${(corporateStats.enriched + stats.filled).toLocaleString("tr-TR")} tamamlandı` +
            ` (+${corporateStats.images.toLocaleString("tr-TR")} fotoğraf), ${(corporateStats.archived + stats.archived).toLocaleString("tr-TR")} satılmış ilan arşivlendi.` +
            (stopping ? " Kullanıcı tarafından durduruldu." : ""),
        },
      }
    ).catch(() => {});
  }

  await report("\n\n📋 SONRAKİ DURUM");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Eksik detay taraması hatası:", err);
  process.exit(1);
});
