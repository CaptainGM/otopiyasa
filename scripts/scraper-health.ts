// Tüm kaynak tarayıcılarının sağlık denetimi. VERİTABANINA YAZMAZ (yalnızca okur ve kaynak sitelere birkaç istek atar).
//   npx tsx scripts/scraper-health.ts            → hepsi
//   npx tsx scripts/scraper-health.ts dod carvak → yalnızca bu kaynaklar
// 1) Her kaynaktan 3 ilan çeker ve alanlarını (başlık, fiyat, fotoğraf, adres) doğrular.
// 2) Kayıtlı ilanların detay sayfasını/kaydını okur (galeri, hasar, tüketim bilgisi gelebiliyor mu).
// 3) Sunucudaki 7/24 motorun son senkron durumunu ve kalp atışını gösterir.
import type { ScrapeAdapter } from "../src/lib/scraper/types";
import { loadEnv } from "./load-env";

loadEnv();

const c = { reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m", bold: "\x1b[1m" };
const ok = (s: string) => `${c.green}✔ ${s}${c.reset}`;
const bad = (s: string) => `${c.red}✘ ${s}${c.reset}`;
const warn = (s: string) => `${c.yellow}! ${s}${c.reset}`;

const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}: ${ms / 1000} sn içinde yanıt gelmedi`)), ms))]);

async function main() {
  const wanted = process.argv.slice(2);
  const { connectDB } = await import("@/lib/mongodb");
  const adapters = await import("@/lib/scraper/adapters");
  const { fetchDetail, DETAIL_SOURCES } = await import("@/lib/scraper/enrich-detail");
  const { Car } = await import("@/models/Car");
  const { SourceSyncState } = await import("@/models/SourceSyncState");
  const { DaemonHeartbeat } = await import("@/models/ScrapeMetric");
  const { default: mongoose } = await import("mongoose");
  await connectDB();

  const sources: Array<{ id: string; adapter: ScrapeAdapter; timeoutMs: number }> = [
    { id: "otokoc", adapter: adapters.otokocAdapter, timeoutMs: 90_000 },
    { id: "otoplus", adapter: adapters.otoplusAdapter, timeoutMs: 90_000 },
    { id: "vavacars", adapter: adapters.vavacarsAdapter, timeoutMs: 90_000 },
    { id: "carvak", adapter: adapters.carvakAdapter, timeoutMs: 120_000 },
    { id: "dod", adapter: adapters.dodAdapter, timeoutMs: 120_000 },
    { id: "otomerkezi", adapter: adapters.otomerkeziAdapter, timeoutMs: 90_000 },
    { id: "ikinciyeni", adapter: adapters.ikinciyeniAdapter, timeoutMs: 90_000 },
    { id: "arabam", adapter: adapters.arabamAdapter, timeoutMs: 180_000 },
  ].filter((s) => wanted.length === 0 || wanted.includes(s.id));

  let problems = 0;
  console.log(`\n${c.bold}${c.cyan}── 1) LİSTE TARAYICILARI (her kaynaktan 3 ilan, kaydedilmez) ──${c.reset}`);
  for (const { id, adapter, timeoutMs } of sources) {
    const got: any[] = [];
    const started = Date.now();
    try {
      await withTimeout(
        adapter.scrape("", 3, async (l) => {
          got.push(l);
        }),
        timeoutMs,
        id
      );
    } catch (err) {
      problems++;
      console.log(`${id.padEnd(11)} ${bad(`hata: ${err instanceof Error ? err.message : err}`)}`);
      continue;
    }
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (got.length === 0) {
      // Bazı kaynaklarda "0 ilan" arıza değildir; asıl kaynağı ayrıca yoklayıp ayırt ederiz.
      if (id === "dod") {
        // DOD'un liste taraması yalnızca veritabanında OLMAYAN ilanları açar; yeni ilan yoksa 0 normaldir.
        const { fetchDodCarUrls } = await import("@/lib/scraper/dod");
        const urls = await fetchDodCarUrls().catch(() => [] as string[]);
        if (urls.length > 0) {
          console.log(`${id.padEnd(11)} ${ok(`yeni ilan yok (sitemap okunuyor: ${urls.length} ilan)`)}`);
        } else {
          problems++;
          console.log(`${id.padEnd(11)} ${bad("sitemap okunamadı (engel ya da site değişmiş olabilir)")}`);
        }
        continue;
      }
      if (id === "ikinciyeni") {
        // İhale sitesi: açık ihale yokken liste boş döner. API cevap veriyorsa kaynak çalışıyordur.
        const probe = await fetch("https://apigw.ikinciyeni.com/ListedVehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "https://www.ikinciyeni.com", Referer: "https://www.ikinciyeni.com/araba-al", "User-Agent": "Mozilla/5.0" },
          body: JSON.stringify({ page: 1, pageSize: 5 }),
          signal: AbortSignal.timeout(15000),
        }).then(async (r) => (r.ok ? ((await r.json()) as { isSucceed?: boolean }) : null)).catch(() => null);
        if (probe?.isSucceed) {
          console.log(`${id.padEnd(11)} ${warn("API çalışıyor ama açık ihale yok (kaynak şu an boş; arıza değil)")}`);
        } else {
          problems++;
          console.log(`${id.padEnd(11)} ${bad("API yanıt vermedi")}`);
        }
        continue;
      }
      problems++;
      console.log(`${id.padEnd(11)} ${bad(`0 ilan geldi (${secs} sn): engel, boş sayfa ya da site değişmiş olabilir`)}`);
      continue;
    }
    const broken = got.filter((l) => !l.title || !(l.price > 0) || !l.externalId || !l.listingUrl || !(l.imageUrl || l.images?.length));
    const first = got[0];
    const line = `${got.length} ilan, ${secs} sn | ${String(first.title).slice(0, 44)} | ${first.price?.toLocaleString("tr-TR")} ₺ | ${first.images?.length ?? (first.imageUrl ? 1 : 0)} foto | ${first.city || "-"}`;
    if (broken.length > 0) {
      problems++;
      console.log(`${id.padEnd(11)} ${warn(`${line}`)}\n${"".padEnd(12)}${c.yellow}${broken.length} ilanda eksik alan (başlık/fiyat/numara/adres/fotoğraf)${c.reset}`);
    } else {
      console.log(`${id.padEnd(11)} ${ok(line)}`);
    }
  }

  console.log(`\n${c.bold}${c.cyan}── 2) DETAY OKUYUCULAR (kayıtlı 2 ilan, kaydedilmez) ──${c.reset}`);
  for (const source of DETAIL_SOURCES) {
    if (wanted.length > 0 && !wanted.includes(source)) continue;
    const docs = await Car.find({ sourceSite: source, status: "active", listingUrl: { $nin: ["", null] } })
      .sort({ lastVerifiedAt: -1 })
      .limit(2)
      .select("listingUrl externalId title")
      .lean<Array<{ listingUrl: string; externalId?: string; title?: string }>>();
    if (docs.length === 0) {
      console.log(`${source.padEnd(11)} ${warn("kayıtlı aktif ilan yok")}`);
      continue;
    }
    const outcomes: string[] = [];
    let good = 0;
    for (const d of docs) {
      try {
        const r = await withTimeout(fetchDetail(source, d.listingUrl, d.externalId, d.title), 60_000, source);
        if (r.kind === "ok") {
          good++;
          outcomes.push(`ok (${r.patch.images?.length ?? 0} foto${r.patch.damageParts?.length ? `, ${r.patch.damageParts.length} parça` : ""}${r.patch.avgFuelConsumption ? `, ${r.patch.avgFuelConsumption}` : ""})`);
        } else {
          outcomes.push(`${r.kind} (${r.reason})`);
        }
      } catch (err) {
        outcomes.push(`hata (${err instanceof Error ? err.message : err})`);
      }
    }
    if (good === 0) problems++;
    console.log(`${source.padEnd(11)} ${good === docs.length ? ok(outcomes.join(" | ")) : good > 0 ? warn(outcomes.join(" | ")) : bad(outcomes.join(" | "))}`);
  }

  console.log(`\n${c.bold}${c.cyan}── 3) SUNUCUDAKİ 7/24 MOTOR ──${c.reset}`);
  const beat = await DaemonHeartbeat.findOne().sort({ lastHeartbeat: -1 }).lean<any>();
  if (beat) {
    const ageMin = Math.round((Date.now() - new Date(beat.lastHeartbeat || 0).getTime()) / 60000);
    console.log(`kalp atışı   ${ageMin <= 15 ? ok(`${ageMin} dk önce`) : bad(`${ageMin} dk önce (motor durmuş olabilir)`)}  ${c.dim}${`${beat.host || ""} | tur #${beat.cycle} | ${String(beat.currentPhase || "")}`.slice(0, 90)}${c.reset}`);
    if (ageMin > 15) problems++;
  } else {
    console.log(`kalp atışı   ${bad("kayıt yok")}`);
    problems++;
  }
  const states = await SourceSyncState.find().lean<any[]>();
  for (const s of states.sort((a, b) => String(a.source).localeCompare(String(b.source)))) {
    const last = s.lastRunAt ? Math.round((Date.now() - new Date(s.lastRunAt).getTime()) / 3600000) : null;
    const success = s.lastSuccessAt ? Math.round((Date.now() - new Date(s.lastSuccessAt).getTime()) / 3600000) : null;
    // İkinciyeni bir ihale sitesi: açık ihale yokken "tam envanter" sayılmaz ama arıza da değildir.
    const fine = s.lastStatus === "ok" || (success !== null && success <= 36) || s.source === "ikinciyeni";
    if (!fine) problems++;
    console.log(
      `${String(s.source).padEnd(11)} ${fine ? ok(`son çalışma ${last ?? "?"} sa önce, son başarı ${success ?? "yok"} sa önce`) : bad(`son başarı ${success ?? "yok"} sa önce`)} ${c.dim}${String(s.lastMessage || s.lastStatus || "").slice(0, 80)}${c.reset}`
    );
  }

  // Arabam ilanları yalnızca evdeki bilgisayardan doğrulanır (arabam-bekci-kur.bat); bilgisayar kapalıyken ilerlemez.
  console.log(`\n${c.bold}${c.cyan}── 4) ARABAM DOĞRULAMA (ev bilgisayarı, bekçi) ──${c.reset}`);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [arabamActive, arabamNever, arabamDay, arabamLast] = await Promise.all([
    Car.countDocuments({ sourceSite: "arabam", status: "active" }),
    Car.countDocuments({ sourceSite: "arabam", status: "active", lastVerifiedAt: { $exists: false } }),
    Car.countDocuments({ sourceSite: "arabam", status: "active", lastVerifiedAt: { $gt: dayAgo } }),
    Car.findOne({ sourceSite: "arabam", lastVerifiedAt: { $exists: true } }).sort({ lastVerifiedAt: -1 }).select("lastVerifiedAt").lean<{ lastVerifiedAt?: Date }>(),
  ]);
  const lastAgeH = arabamLast?.lastVerifiedAt ? Math.round((Date.now() - new Date(arabamLast.lastVerifiedAt).getTime()) / 3600000) : null;
  const fmt = (n: number) => n.toLocaleString("tr-TR");
  console.log(`aktif ilan    ${fmt(arabamActive)} | hiç doğrulanmamış ${fmt(arabamNever)} | son 24 saatte doğrulanan ${fmt(arabamDay)}`);
  console.log(`son doğrulama ${lastAgeH === null ? bad("hiç yok") : lastAgeH <= 72 ? ok(`${lastAgeH} sa önce`) : warn(`${lastAgeH} sa önce (bekçi çalışmıyor olabilir: arabam-bekci-durum.bat)`)}`);

  console.log(`\n${problems === 0 ? ok("Tüm kaynaklar sağlıklı görünüyor.") : bad(`${problems} sorun bulundu (yukarıda işaretli).`)}\n`);
  await mongoose.disconnect();
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Sağlık denetimi hatası:", err);
  process.exit(2);
});
