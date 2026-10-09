import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { FeatureProbe } from "@/models/FeatureProbe";
import { DaemonHeartbeat } from "@/models/ScrapeMetric";
import { HOME_WATCHER_ID, HomeWatcherState } from "@/models/HomeWatcher";
import { ManualScrapeLog } from "@/models/ManualScrapeLog";
import { ManualScrapeState } from "@/models/ManualScrapeState";
import { describeDaemon } from "@/lib/daemon-status";
import { isManualScrapeRunning } from "@/lib/manual-scrape-state";
import { formatRelativeTr } from "@/lib/utils";

/**
 * SİTE ÖZELLİKLERİ SAĞLIK KONTROLÜ (yönetim paneli, web). Her özellik için küçük bir deneme çalıştırılır ve sonucu yeşil/kırmızı gösterilir.
 *
 * Kurallar: hiçbir kontrol veritabanına kayıt EKLEMEZ, e-posta GÖNDERMEZ, hesap açmaz ve hız sınırlı uç noktalara (giriş, kayıt) HTTP isteği
 * atmaz (sınırlayıcıyı tüketip yanlış alarm üretirdi). Ağır kontroller ve yapay zekâ kontrolleri her sorguda değil, [ttlMs] dolunca yeniden
 * çalışır; aradaki sorgular son sonucu verir. Bir kontrolün hata vermesi diğerlerini bozmaz.
 */

export type ProbeGroup = "Veri toplama" | "Site özellikleri" | "Hesap" | "Denetim";

export interface ProbeOutcome {
  ok: boolean;
  detail: string;
}

export interface ProbeDefinition {
  key: string;
  label: string;
  group: ProbeGroup;
  /** Süresi (ms): bu aralıktan sık gerçek deneme yapılmaz. 0 = her sorguda (yine de 45 sn önbellek). */
  ttlMs: number;
  /** true: kırmızı olması arıza anlamına gelmez (ör. elle tarama o an çalışmıyor, evdeki bilgisayar kapalı). */
  informational?: boolean;
  /** true: yapay zekâ kotası harcar. */
  ai?: boolean;
  timeoutMs?: number;
  run: () => Promise<ProbeOutcome>;
}

export interface ProbeResult {
  key: string;
  label: string;
  group: ProbeGroup;
  ok: boolean;
  detail: string;
  ms: number;
  checkedAt: string;
  lastOkAt: string | null;
  informational: boolean;
  ai: boolean;
}

const MINUTE = 60_000;
export const CHEAP_TTL_MS = 45_000;

/** Zaman aşımı ve hata yakalama: sonuç her zaman bir ProbeOutcome olur. */
export async function runGuarded(run: () => Promise<ProbeOutcome>, timeoutMs: number): Promise<ProbeOutcome & { ms: number }> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      run(),
      new Promise<ProbeOutcome>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${Math.round(timeoutMs / 1000)} sn içinde yanıt vermedi`)), timeoutMs);
      }),
    ]);
    return { ...outcome, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error), ms: Date.now() - started };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Son sonuç hâlâ geçerli mi (süresi dolmadıysa yeniden denenmez)? */
export function isFresh(checkedAt: Date | string | null | undefined, ttlMs: number, now = Date.now()): boolean {
  if (!checkedAt) return false;
  return now - new Date(checkedAt).getTime() < Math.max(ttlMs, CHEAP_TTL_MS);
}

/** Genel durum: arıza sayısı (bilgi amaçlı kontroller sayılmaz). */
export function summarize(results: Array<Pick<ProbeResult, "ok" | "informational">>): { total: number; failing: number; allOk: boolean } {
  const counted = results.filter((r) => !r.informational);
  const failing = counted.filter((r) => !r.ok).length;
  return { total: counted.length, failing, allOk: failing === 0 };
}

const ago = (date: Date | string | null | undefined) => (date ? formatRelativeTr(date as string) : "hiç");

// --------------------------------------------------------------------------------------------------------------------------------

async function sampleCarIds(count: number): Promise<string[]> {
  const rows = await Car.find({ status: "active", moderationStatus: { $nin: ["pending", "rejected"] } })
    .select("_id")
    .sort({ updatedAt: -1 })
    .limit(count)
    .lean<Array<{ _id: { toString(): string } }>>();
  return rows.map((r) => r._id.toString());
}

/** Rota işleyicisini HTTP olmadan çağırır (hız sınırı ve ağ gecikmesi dışarıda kalır, rotanın kendi kodu çalışır). */
async function callRoute(handler: (request: Request) => Promise<Response>, path: string): Promise<{ status: number; json: unknown }> {
  const response = await handler(new Request(`http://health.local${path}`));
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

export const PROBES: ProbeDefinition[] = [
  // ---- Veri toplama
  {
    key: "scrape-auto",
    label: "Otonom scrape (7/24 sunucu)",
    group: "Veri toplama",
    ttlMs: 0,
    async run() {
      const heartbeat = await DaemonHeartbeat.findOne({ daemonId: "primary-daemon" }).lean();
      const status = describeDaemon(heartbeat as never);
      return status.isOnline
        ? { ok: true, detail: `Çalışıyor · son sinyal ${ago(status.lastHeartbeat)} · tur #${status.cycle}` }
        : { ok: false, detail: status.status === "stopped" ? "Durduruldu" : `Sinyal yok (${ago(status.lastHeartbeat)})` };
    },
  },
  {
    key: "scrape-manual",
    label: "Manuel scrape",
    group: "Veri toplama",
    ttlMs: 0,
    informational: true,
    async run() {
      const [state, watcher, last] = await Promise.all([
        ManualScrapeState.findOne({ key: "manual" }).lean<{ running?: boolean; heartbeatAt?: Date | null; label?: string; startedAt?: Date | null }>(),
        HomeWatcherState.findOne({ watcherId: HOME_WATCHER_ID }).lean<{ phase?: string; lastHeartbeat?: Date }>(),
        ManualScrapeLog.findOne().sort({ createdAt: -1 }).select("label inserted createdAt").lean<{ label?: string; inserted?: number; createdAt?: Date }>(),
      ]);
      if (isManualScrapeRunning(state)) return { ok: true, detail: `Çalışıyor: ${state?.label || "tarama"} · ${ago(state?.startedAt)} başladı` };
      // Sunucu işareti yoksa (başka betikler) bekçinin "elle tarama sürüyor" bilgisine bakılır.
      const heldByWatcher = watcher?.phase?.startsWith("Elle tarama") && watcher.lastHeartbeat && Date.now() - new Date(watcher.lastHeartbeat).getTime() < 3 * MINUTE;
      if (heldByWatcher) return { ok: true, detail: watcher!.phase!.slice(0, 80) };
      return { ok: false, detail: last?.createdAt ? `Çalışmıyor · son: ${ago(last.createdAt)} (+${last.inserted ?? 0} ilan)` : "Çalışmıyor" };
    },
  },
  {
    key: "watcher",
    label: "Evdeki bekçi (Arabam doğrulama)",
    group: "Veri toplama",
    ttlMs: 0,
    informational: true,
    async run() {
      const w = await HomeWatcherState.findOne({ watcherId: HOME_WATCHER_ID }).lean<{ status?: string; phase?: string; lastHeartbeat?: Date }>();
      const fresh = w?.lastHeartbeat && Date.now() - new Date(w.lastHeartbeat).getTime() < 10 * MINUTE;
      return fresh
        ? { ok: true, detail: `Çalışıyor · ${(w?.phase || "").slice(0, 70)}` }
        : { ok: false, detail: `Sinyal yok (${ago(w?.lastHeartbeat)}); bilgisayar kapalı olabilir` };
    },
  },
  {
    key: "database",
    label: "Veritabanı",
    group: "Veri toplama",
    ttlMs: 0,
    async run() {
      const active = await Car.countDocuments({ status: "active" }).hint({ status: 1, createdAt: -1 }).maxTimeMS(8000);
      return active > 0 ? { ok: true, detail: `${active.toLocaleString("tr-TR")} aktif ilan okunuyor` } : { ok: false, detail: "Aktif ilan bulunamadı" };
    },
  },

  // ---- Site özellikleri
  {
    key: "map",
    label: "Harita",
    group: "Site özellikleri",
    ttlMs: 5 * MINUTE,
    async run() {
      const { GET } = await import("@/app/api/map/route");
      const { status, json } = await callRoute(GET, "/api/map");
      const clusters = (json as { clusters?: unknown[]; data?: unknown[] } | null)?.clusters ?? (json as { data?: unknown[] } | null)?.data;
      if (status !== 200 || !Array.isArray(clusters) || clusters.length === 0) return { ok: false, detail: `Küme verisi gelmedi (HTTP ${status})` };
      return { ok: true, detail: `${clusters.length} bölge işareti yükleniyor` };
    },
  },
  {
    key: "compare",
    label: "İlan karşılaştırma",
    group: "Site özellikleri",
    ttlMs: 5 * MINUTE,
    async run() {
      const ids = await sampleCarIds(2);
      if (ids.length < 2) return { ok: false, detail: "Karşılaştırılacak ilan bulunamadı" };
      const { GET } = await import("@/app/api/compare/route");
      const { status, json } = await callRoute(GET, `/api/compare?ids=${ids.join(",")}`);
      if (status !== 200 || (json as { error?: string } | null)?.error) return { ok: false, detail: `Karşılaştırma yanıt vermedi (HTTP ${status})` };
      return { ok: true, detail: "İki ilan karşılaştırıldı" };
    },
  },
  {
    key: "predict",
    label: "Fiyat tahmini",
    group: "Site özellikleri",
    ttlMs: 10 * MINUTE,
    async run() {
      const { predictPrice } = await import("@/lib/price-prediction");
      const result = await predictPrice("Toyota", "Corolla", 2018, 90000, "clean");
      return Number.isFinite(result.predictedPrice) && result.predictedPrice > 100_000
        ? { ok: true, detail: `Örnek tahmin: ${Math.round(result.predictedPrice).toLocaleString("tr-TR")} ₺` }
        : { ok: false, detail: "Tahmin sayısal değer üretmedi" };
    },
  },
  {
    key: "depreciation",
    label: "Değer kaybı",
    group: "Site özellikleri",
    ttlMs: 10 * MINUTE,
    async run() {
      const { modelEffects, conditionCurves } = await import("@/lib/depreciation");
      const rows = await Car.find({ brand: /^toyota$/i, model: /^corolla/i, status: "active", price: { $gt: 0 } })
        .select("year mileage price damageFlag")
        .limit(400)
        .lean<Array<{ year: number; mileage: number; price: number; damageFlag?: boolean }>>();
      const prepared = rows.map((r) => ({ year: r.year, mileage: r.mileage, price: r.price, condition: (r.damageFlag ? "damaged" : "clean") as "damaged" | "clean" }));
      const effects = modelEffects(prepared);
      const curves = conditionCurves(prepared);
      return effects.sample >= 15 && curves.length > 0
        ? { ok: true, detail: `Corolla: ${effects.sample} ilanla hesaplandı` }
        : { ok: false, detail: "Hesap için yeterli ilan ya da sonuç yok" };
    },
  },
  {
    key: "analytics",
    label: "Analizler",
    group: "Site özellikleri",
    ttlMs: 15 * MINUTE,
    timeoutMs: 20_000,
    async run() {
      const { getAnalyticsData } = await import("@/lib/analytics-data");
      const data = (await getAnalyticsData()) as unknown as Record<string, unknown>;
      return data && Object.keys(data).length > 0 ? { ok: true, detail: "Analiz verisi hesaplandı" } : { ok: false, detail: "Analiz verisi boş" };
    },
  },
  {
    key: "chatbot",
    label: "Chatbot",
    group: "Site özellikleri",
    ttlMs: 30 * MINUTE,
    ai: true,
    timeoutMs: 30_000,
    async run() {
      const { isGeminiConfigured } = await import("@/lib/gemini");
      if (!isGeminiConfigured()) return { ok: false, detail: "Yapay zekâ anahtarı tanımlı değil" };
      const { answerQuery } = await import("@/lib/chatbot");
      const reply = await answerQuery("100 bin km altı otomatik araba öner");
      return reply.reply && reply.reply.trim().length > 5 ? { ok: true, detail: "Soruya yanıt verdi" } : { ok: false, detail: "Boş yanıt döndü" };
    },
  },

  // ---- Hesap
  {
    key: "register",
    label: "Hesap açma (kayıt)",
    group: "Hesap",
    ttlMs: 5 * MINUTE,
    async run() {
      const [{ passwordError }, { isDisposableEmail, canonicalEmail }, { isMailerConfigured, verifyMailerConnection }] = await Promise.all([
        import("@/lib/password-policy"),
        import("@/lib/email-policy"),
        import("@/lib/mailer"),
      ]);
      const problems: string[] = [];
      if (!passwordError("zayif")) problems.push("şifre kuralı çalışmıyor");
      if (!isDisposableEmail("x@mailinator.com")) problems.push("geçici e-posta engeli çalışmıyor");
      if (canonicalEmail("A.b+x@gmail.com") !== "ab@gmail.com") problems.push("e-posta tekilleştirme bozuk");
      await User.estimatedDocumentCount();
      if (!isMailerConfigured()) problems.push("e-posta (SMTP) ayarı yok: doğrulama bağlantısı gönderilemez");
      else {
        try {
          await verifyMailerConnection();
        } catch (error) {
          problems.push(`e-posta sunucusuna bağlanılamadı (${error instanceof Error ? error.message.slice(0, 60) : "hata"})`);
        }
      }
      return problems.length ? { ok: false, detail: problems.join("; ") } : { ok: true, detail: "Kurallar ve doğrulama e-postası hazır" };
    },
  },
  {
    key: "login",
    label: "Giriş / çıkış",
    group: "Hesap",
    ttlMs: 5 * MINUTE,
    async run() {
      const { createToken, verifyToken } = await import("@/lib/auth");
      const token = await createToken({ userId: "000000000000000000000000", email: "probe@otopiyasa.local", name: "probe", role: "user", jti: "probe" });
      const payload = await verifyToken(token);
      if (payload?.userId !== "000000000000000000000000") return { ok: false, detail: "Oturum anahtarı doğrulanamadı (JWT_SECRET)" };
      const admins = await User.countDocuments({ role: "admin" });
      return admins > 0 ? { ok: true, detail: "Oturum anahtarı ve hesap kaydı çalışıyor" } : { ok: false, detail: "Yönetici hesabı okunamadı" };
    },
  },

  // ---- Denetim
  {
    key: "listing-rules",
    label: "İlan verme: kural denetimi",
    group: "Denetim",
    ttlMs: 0,
    async run() {
      const { checkListingText } = await import("@/lib/content-filter");
      const scam = checkListingText(["Aracı beğendiyseniz kapora için IBAN TR33 0006 1005 1978 6457 8413 26 numarasına yatırın"]);
      const link = checkListingText(["Detaylar için http://hizli-arac-satis.example/ilan adresine bak"]);
      const clean = checkListingText(["Bakımlı, hasarsız, ikinci el araç. Yetkili serviste bakımları yapıldı."]);
      const problems = [scam.ok && "IBAN/kapora yakalanmadı", link.ok && "dış bağlantı yakalanmadı", !clean.ok && "temiz ilan yanlışlıkla engellendi"].filter(Boolean);
      return problems.length ? { ok: false, detail: problems.join("; ") } : { ok: true, detail: "IBAN, kapora ve bağlantı engelleniyor, temiz ilan geçiyor" };
    },
  },
  {
    key: "listing-ai",
    label: "İlan verme: yapay zekâ denetimi",
    group: "Denetim",
    ttlMs: 30 * MINUTE,
    ai: true,
    timeoutMs: 30_000,
    async run() {
      const { isGeminiConfigured, moderateListing } = await import("@/lib/gemini");
      if (!isGeminiConfigured()) return { ok: false, detail: "Yapay zekâ anahtarı tanımlı değil" };
      const verdict = await moderateListing({
        brand: "Toyota",
        model: "Corolla",
        year: 2018,
        price: 850000,
        mileage: 90000,
        city: "Ankara",
        description: "Bakımlı, hasarsız araç. Detaylı bilgi için mesaj atın.",
      });
      return verdict ? { ok: true, detail: `Denetim yanıt verdi (${verdict.approved ? "onay" : "ret"})` } : { ok: false, detail: "Yapay zekâ yanıt vermedi (kota ya da bağlantı)" };
    },
  },
  {
    key: "chat-filter",
    label: "İlan sohbeti: küfür, IBAN, bağlantı denetimi",
    group: "Denetim",
    ttlMs: 0,
    async run() {
      const { assessMessageRisk } = await import("@/lib/chat-safety");
      const { containsProfanity, checkPublicText } = await import("@/lib/content-filter");
      const problems: string[] = [];
      if (!containsProfanity("siktir git")) problems.push("küfür yakalanmadı");
      if (!assessMessageRisk("iban atar mısın, havale yapayım").includes("payment-info")) problems.push("IBAN/havale yakalanmadı");
      if (!assessMessageRisk("whatsapp'tan yazın https://wa.me/905000000000").length) problems.push("dış bağlantı/yönlendirme yakalanmadı");
      if (!checkPublicText("fiyatta pazarlık payı var mı?").ok) problems.push("normal mesaj yanlışlıkla engellendi");
      return problems.length ? { ok: false, detail: problems.join("; ") } : { ok: true, detail: "Küfür, IBAN ve dış bağlantı yakalanıyor, normal mesaj geçiyor" };
    },
  },
  {
    key: "photo-ai",
    label: "Profil fotoğrafı denetimi",
    group: "Denetim",
    ttlMs: 0,
    async run() {
      const { isGeminiConfigured } = await import("@/lib/gemini");
      return isGeminiConfigured()
        ? { ok: true, detail: "Yapay zekâ anahtarı tanımlı; yüklenen fotoğraflar denetleniyor" }
        : { ok: false, detail: "Yapay zekâ anahtarı yok: fotoğraf yüklemeleri reddedilir" };
    },
  },
];

// --------------------------------------------------------------------------------------------------------------------------------

/**
 * Tüm kontrolleri sonuç listesi olarak verir. Süresi dolmayanların son sonucu kullanılır, dolanlar çalıştırılıp kaydedilir.
 * [force]: ağır ve yapay zekâ kontrolleri dahil hepsi yeniden denenir (yönetici "şimdi kontrol et"e basınca; yapay zekâ olanlar
 * kotayı korumak için en erken 2 dakikada bir yeniden denenir).
 */
export async function runProbes(options: { force?: boolean; probes?: ProbeDefinition[]; now?: number } = {}): Promise<ProbeResult[]> {
  const probes = options.probes ?? PROBES;
  const now = options.now ?? Date.now();
  const stored = await FeatureProbe.find({ key: { $in: probes.map((p) => p.key) } }).lean<
    Array<{ key: string; ok: boolean; detail: string; ms: number; checkedAt: Date; lastOkAt?: Date | null }>
  >();
  const byKey = new Map(stored.map((s) => [s.key, s]));

  return Promise.all(
    probes.map(async (probe): Promise<ProbeResult> => {
      const previous = byKey.get(probe.key);
      const ttl = options.force ? (probe.ai ? 2 * MINUTE : CHEAP_TTL_MS) : probe.ttlMs;
      const base = { key: probe.key, label: probe.label, group: probe.group, informational: Boolean(probe.informational), ai: Boolean(probe.ai) };

      if (previous && isFresh(previous.checkedAt, ttl, now)) {
        return {
          ...base,
          ok: previous.ok,
          detail: previous.detail,
          ms: previous.ms,
          checkedAt: new Date(previous.checkedAt).toISOString(),
          lastOkAt: previous.lastOkAt ? new Date(previous.lastOkAt).toISOString() : null,
        };
      }

      const outcome = await runGuarded(probe.run, probe.timeoutMs ?? 12_000);
      const checkedAt = new Date(now);
      const lastOkAt = outcome.ok ? checkedAt : previous?.lastOkAt ? new Date(previous.lastOkAt) : null;
      await FeatureProbe.updateOne(
        { key: probe.key },
        { $set: { ok: outcome.ok, detail: outcome.detail.slice(0, 300), ms: outcome.ms, checkedAt, lastOkAt } },
        { upsert: true }
      ).catch(() => {});
      return { ...base, ok: outcome.ok, detail: outcome.detail, ms: outcome.ms, checkedAt: checkedAt.toISOString(), lastOkAt: lastOkAt ? lastOkAt.toISOString() : null };
    })
  );
}
