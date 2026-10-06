import type { Types } from "mongoose";
import { Car } from "@/models/Car";
import { ArabamListSweep, ArabamListSweepDoc } from "@/models/ArabamListSweep";
import { modelFamily, modelFamilyKey, modelFamilyRegex } from "@/lib/model-family";
import { brandStorageAliases, normalizeBrand } from "@/lib/normalize-brand";
import { turkishSearchRegex } from "@/lib/utils";
import { normalizeBodyType } from "@/lib/vehicle-attrs";
import { notifyFavoritePriceDrop } from "@/lib/price-alerts";
import { fetchPageWithBrowser, isCloudflareChallenge } from "@/lib/scraper/browser-scrape";
import { waitForArabamTurn } from "@/lib/scraper/verify-listing";
import { ArabamListDoc, ArabamListPage, dominantBodyType, parseArabamListPage } from "@/lib/scraper/arabam-list";

/**
 * BEKÇİ LİSTE TARAMASI
 *
 * İlan sayfası tek istekte tek ilanı doğrular. Model liste sayfası (`/ikinci-el/otomobil/chevrolet-captiva?page=N`,
 * robots.txt'e uygun) ise tek istekte 20 ilanın vitesini, yakıtını, rengini, km'sini ve fiyatını verir; bizde olanlar
 * "canlı" da işaretlenir. Ölçüm (2026-10-06): Captiva sayfasındaki 20 ilanın 7'si bizdeydi ve yedisinin vitesi
 * veritabanında "Manuel" (tahmin), gerçekte "Otomatik"ti. Kaynakta çok ilanı olan modellerde (Egea: 8.008 ilan,
 * bizde 532) bir sayfada bizden ilan çıkma ihtimali düşüktür; bu yüzden aileler "sayfa başına bizden kaç ilan çıkar"
 * oranına göre seçilir, ilan sayfası kontrolünden verimsiz olanlar taranmaz.
 *
 * Kasa tipi liste verisinde yoktur; modelin kasa tipi sayımı tek tipte toplanıyorsa (Captiva: 613 SUV, 1 Crossover)
 * o tip ailedeki ilanlarımıza yazılır.
 */

export const LIST_SWEEP = {
  /** Aile planı (doğrulanmamış ilan sayıları) bu sıklıkla yeniden hesaplanır. */
  replanMs: 12 * 60 * 60 * 1000,
  /**
   * Sayfa başına beklenen doğrulanmamış ilan oranı bunun altındaysa aile taranmaz. 0,1 = sayfa başına ~2 ilan:
   * ilan sayfası kontrolü (1 ilan, ama tüm özellikler ve ölü ilan tespiti) karşısında en az iki kat verim.
   * Ölçüm: Corolla 397/6.232 (%6) → 0 ilan; Sandero 353/1.208 (%29) → 7 ilan.
   */
  minRatio: 0.1,
  /** Kaynaktaki toplamı henüz bilinmeyen aile için varsayılan oran: önce bir kez bakılsın diye iyimser. */
  unknownRatio: 0.15,
  /** Bilinmeyen aileyi denemek için en az bu kadar doğrulanmamış ilanı olmalı. */
  minUnverifiedToProbe: 6,
  /** Tamamı gezilen ya da sayfası bulunamayan aileye bu kadar süre dönülmez. */
  revisitMs: 7 * 24 * 60 * 60 * 1000,
  notFoundRetryMs: 30 * 24 * 60 * 60 * 1000,
};

const slug = (text: string) =>
  text
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Doğrulanmamış vites: ilan sayfasından da listeden de teyit edilmemiş. */
const UNVERIFIED_GEAR_EXPR = {
  $and: [
    { $not: [{ $ifNull: ["$featuresVerifiedAt", false] }] },
    { $not: [{ $in: ["transmission", { $ifNull: ["$verifiedFeatures", []] }] }] },
  ],
};

/** Ailelerdeki aktif ve doğrulanmamış ilan sayılarını yeniler (bekçinin taranan sayfa durumu korunur). */
export async function refreshListSweepPlan(now = new Date()): Promise<number> {
  const rows = await Car.aggregate<{ _id: { b: string; m: string }; n: number; u: number; suv: number }>([
    { $match: { sourceSite: "arabam", status: "active" } },
    {
      $group: {
        _id: { b: "$brand", m: "$model" },
        n: { $sum: 1 },
        u: { $sum: { $cond: [UNVERIFIED_GEAR_EXPR, 1, 0] } },
        suv: { $sum: { $cond: [{ $eq: ["$features.bodyType", "SUV"] }, 1, 0] } },
      },
    },
  ]).option({ maxTimeMS: 30000 });

  const families = new Map<string, { brand: string; model: string; ours: number; unverified: number; suv: number }>();
  for (const row of rows) {
    const brand = normalizeBrand(row._id.b || "");
    const key = modelFamilyKey(row._id.m, brand);
    if (!brand || !key) continue;
    const k = `${slug(brand)}|${key}`;
    const f = families.get(k) || { brand, model: modelFamily(row._id.m, brand), ours: 0, unverified: 0, suv: 0 };
    f.ours += row.n;
    f.unverified += row.u;
    f.suv += row.suv;
    families.set(k, f);
  }

  const ops = [...families.entries()].map(([key, f]) => ({
    updateOne: {
      filter: { key },
      update: {
        $set: { brand: f.brand, model: f.model, ours: f.ours, unverified: f.unverified, suvLikely: f.suv >= f.ours * 0.8 },
        $setOnInsert: { key, nextPage: 1, pagesFetched: 0, matched: 0 },
      },
      upsert: true,
    },
  }));
  // Artık aktif ilanımız olmayan aileler seçilmesin.
  await ArabamListSweep.updateMany({ key: { $nin: [...families.keys()] } }, { $set: { unverified: 0, ours: 0 } });
  for (let i = 0; i < ops.length; i += 500) await ArabamListSweep.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  await ArabamListSweep.updateOne({ key: "__plan__" }, { $set: { brand: "-", model: "-", lastFetchedAt: now } }, { upsert: true });
  return families.size;
}

/** Sayfa başına beklenen doğrulanmamış ilan oranı (seçim puanı). */
export function sweepRatio(f: Pick<ArabamListSweepDoc, "unverified" | "total">): number {
  if (!(f.unverified > 0)) return 0;
  if (f.total === null || f.total === undefined) return LIST_SWEEP.unknownRatio;
  return f.total > 0 ? Math.min(1, f.unverified / f.total) : 0;
}

/** Sıradaki aile: oranı en yüksek olan; oranı eşiğin altındaki ve bekleme süresindeki aileler seçilmez. */
export function pickFamily<T extends ArabamListSweepDoc>(families: T[], now: Date): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const f of families) {
    if (f.key === "__plan__") continue;
    if (f.skipUntil && new Date(f.skipUntil).getTime() > now.getTime()) continue;
    if (f.total == null && f.unverified < LIST_SWEEP.minUnverifiedToProbe) continue;
    const ratio = sweepRatio(f);
    if (ratio < LIST_SWEEP.minRatio) continue;
    // Eşit oranda doğrulanmamış ilanı çok olan önce.
    const score = ratio * 1000 + Math.min(f.unverified, 999) / 1000;
    if (score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

type FetchOutcome = { kind: "ok"; page: ArabamListPage } | { kind: "blocked" | "error"; reason: string };

async function fetchListPage(url: string): Promise<FetchOutcome> {
  try {
    await waitForArabamTurn();
    const res = await fetchPageWithBrowser(url, true);
    if (isCloudflareChallenge(res.html) || res.status === 403 || res.status === 429) {
      return { kind: "blocked", reason: `Cloudflare/hız sınırı (HTTP ${res.status})` };
    }
    return { kind: "ok", page: parseArabamListPage(res.html) };
  } catch (err) {
    return { kind: "error", reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Sayfadaki ilanların hepsi tek model yolundaysa ve aranan aileye aitse o yolu döndürür. */
export function matchModelPath(page: ArabamListPage, brand: string, model: string): string | null {
  const paths = new Set(page.docs.map((d) => d.modelPath).filter((p): p is string => Boolean(p)));
  if (page.docs.length === 0 || paths.size !== 1) return null;
  const path = [...paths][0];
  const last = path.split("/").pop() || "";
  const brandSlug = slug(brand);
  const wanted = `${brandSlug}-${slug(model)}`;
  if (!last.startsWith(`${brandSlug}-`)) return null;
  // Kaynak yalnızca "serisi" ekini kısaltıyor ("mercedes-benz-c-serisi" → "mercedes-benz-c"). Başka kısaltma
  // kabul edilmez: "toyota-corolla-cross" isteği "toyota-corolla" sayfasına düşerse Corolla'nın kasa tipi
  // (sedan) Corolla Cross ilanlarına yazılırdı.
  return last === wanted || wanted === `${last}-serisi` ? path : null;
}

export interface ListApplyResult {
  matched: number;
  /** Vitesi veritabanındakinden farklı çıkan (tahmini yanlış olan) ilanlar. */
  corrected: number;
  priceChanged: number;
  /** Bizde arşivde olup kaynakta yayında görünenler: ilan sayfasından yeniden kontrol edilecek. */
  recheck: number;
}

/** Sayfadaki bizde olan ilanlara gerçek vites/yakıt/renk/km/fiyatı yazar ve onları "canlı" işaretler. */
export async function applyListDocs(docs: ArabamListDoc[], now = new Date()): Promise<ListApplyResult> {
  const out: ListApplyResult = { matched: 0, corrected: 0, priceChanged: 0, recheck: 0 };
  if (docs.length === 0) return out;
  const byExternal = new Map(docs.map((d) => [`arabam-${d.id}`, d]));
  const cars = await Car.find({ sourceSite: "arabam", externalId: { $in: [...byExternal.keys()] } })
    .select("_id externalId status removedReason price mileage features.transmission")
    .lean<
      Array<{
        _id: Types.ObjectId;
        externalId: string;
        status: string;
        removedReason?: string;
        price: number;
        mileage: number;
        features?: { transmission?: string };
      }>
    >();

  const ops: any[] = [];
  const priceUpdates: Array<{ id: Types.ObjectId; price: number; oldPrice: number }> = [];
  const recheckIds: Types.ObjectId[] = [];
  for (const car of cars) {
    const doc = byExternal.get(car.externalId);
    if (!doc) continue;
    if (car.status === "removed") {
      // Yalnızca otomatik arşivlenen (yönetici ya da şikâyet ile kaldırılmamış) ilan yeniden kontrole alınır.
      if (/^arabam/i.test(car.removedReason || "")) recheckIds.push(car._id);
      continue;
    }
    if (car.status !== "active") continue;
    out.matched++;

    const set: Record<string, unknown> = { lastVerifiedAt: now, lastVerifyAttemptAt: now };
    const keys: string[] = [];
    if (doc.transmission) {
      set["features.transmission"] = doc.transmission;
      keys.push("transmission");
      if (doc.transmission !== car.features?.transmission) out.corrected++;
    }
    if (doc.fuelType) {
      set["features.fuelType"] = doc.fuelType;
      keys.push("fuelType");
    }
    if (doc.color) {
      set["features.color"] = doc.color;
      keys.push("color");
    }
    if (doc.mileage && doc.mileage < 2_000_000 && Math.abs(doc.mileage - (car.mileage || 0)) > 50) set.mileage = doc.mileage;
    // Fiyat ayrıştırma hatasına karşı aynı alt/üst sınır (bkz. verify-listing sanitizeRefresh).
    if (doc.price && car.price > 0 && doc.price !== car.price && doc.price >= car.price * 0.2 && doc.price <= car.price * 5) {
      priceUpdates.push({ id: car._id, price: doc.price, oldPrice: car.price });
    }
    ops.push({
      updateOne: {
        filter: { _id: car._id },
        update: {
          $set: set,
          $unset: { missingSince: 1, missingChecks: 1, lastVerifyStatus: 1 },
          ...(keys.length ? { $addToSet: { verifiedFeatures: { $each: keys } } } : {}),
        },
        timestamps: false,
      },
    });
  }

  if (ops.length) await Car.bulkWrite(ops, { ordered: false });
  if (recheckIds.length) {
    await Car.updateMany({ _id: { $in: recheckIds } }, { $set: { needsRecheck: true } }, { timestamps: false });
    out.recheck = recheckIds.length;
  }
  // Fiyat değişimi fiyat geçmişine ve favori bildirimine de işlenir (saveListing ile aynı davranış).
  for (const u of priceUpdates) {
    try {
      const car = await Car.findById(u.id);
      if (!car || car.price !== u.oldPrice) continue;
      car.price = u.price;
      car.priceHistory.push({ price: u.price, recordedAt: now });
      await car.save();
      out.priceChanged++;
      if (u.price < u.oldPrice) await notifyFavoritePriceDrop(car, u.oldPrice).catch(() => {});
    } catch {
      // tek ilanın fiyatı yazılamazsa diğerleri devam eder
    }
  }
  return out;
}

/** Modelin kasa tipi tek tipse ailedeki ilanlarımıza yazar. */
async function applyFamilyBodyType(family: ArabamListSweepDoc, page: ArabamListPage): Promise<string | null> {
  const label = dominantBodyType(page.bodyTypes, normalizeBodyType);
  if (!label) return null;
  await Car.updateMany(
    {
      sourceSite: "arabam",
      status: "active",
      brand: { $in: brandStorageAliases(family.brand).map((b) => new RegExp(`^${turkishSearchRegex(b)}$`, "i")) },
      model: modelFamilyRegex(family.model, family.brand),
    },
    { $set: { "features.bodyType": label }, $addToSet: { verifiedFeatures: "bodyType" } },
    { timestamps: false }
  );
  return label;
}

export interface ListSweepStepResult {
  /** Bir sayfa çekildi mi (çekilecek uygun aile yoksa false). */
  picked: boolean;
  blocked: boolean;
  failed: boolean;
  requests: number;
  matched: number;
  corrected: number;
  message: string;
}

/**
 * Bekçinin bir adımı: sıradaki ailenin bir sonraki liste sayfasını çeker ve işler. Model sayfasının yolu ilk kez
 * aranıyorsa en fazla iki kategori denenir (otomobil / arazi-suv-pick-up).
 */
export async function runListSweepStep(now = new Date()): Promise<ListSweepStepResult> {
  const base: ListSweepStepResult = { picked: false, blocked: false, failed: false, requests: 0, matched: 0, corrected: 0, message: "" };

  const plan = await ArabamListSweep.findOne({ key: "__plan__" }).select("lastFetchedAt").lean<{ lastFetchedAt?: Date }>();
  if (!plan?.lastFetchedAt || now.getTime() - new Date(plan.lastFetchedAt).getTime() > LIST_SWEEP.replanMs) {
    await refreshListSweepPlan(now);
  }

  const families = await ArabamListSweep.find({ unverified: { $gt: 0 } }).lean<ArabamListSweepDoc[]>();
  const family = pickFamily(families, now);
  if (!family) return { ...base, message: "Liste taraması için verimli model kalmadı." };
  const label = `${family.brand} ${family.model}`;

  let path = family.path || null;
  let page: ArabamListPage | null = null;
  let pageNo = family.nextPage || 1;
  let requests = 0;

  if (!path) {
    pageNo = 1;
    const familySlug = `${slug(family.brand)}-${slug(family.model)}`;
    const categories = family.suvLikely ? ["arazi-suv-pick-up", "otomobil"] : ["otomobil", "arazi-suv-pick-up"];
    for (const category of categories) {
      const res = await fetchListPage(`https://www.arabam.com/ikinci-el/${category}/${familySlug}`);
      requests++;
      if (res.kind !== "ok") {
        return { ...base, picked: true, requests, blocked: res.kind === "blocked", failed: res.kind === "error", message: `${label}: ${res.reason}` };
      }
      const found = matchModelPath(res.page, family.brand, family.model);
      if (found) {
        path = found;
        page = res.page;
        break;
      }
    }
    if (!path) {
      await ArabamListSweep.updateOne(
        { key: family.key },
        { $set: { skipUntil: new Date(now.getTime() + LIST_SWEEP.notFoundRetryMs), note: "Kaynakta model sayfası bulunamadı" } }
      );
      return { ...base, picked: true, requests, message: `${label}: kaynakta model sayfası bulunamadı, 30 gün atlanacak.` };
    }
  }

  if (!page) {
    const res = await fetchListPage(`https://www.arabam.com/ikinci-el/${path}${pageNo > 1 ? `?page=${pageNo}` : ""}`);
    requests++;
    if (res.kind !== "ok") {
      return { ...base, picked: true, requests, blocked: res.kind === "blocked", failed: res.kind === "error", message: `${label} s.${pageNo}: ${res.reason}` };
    }
    page = res.page;
  }

  const applied = await applyListDocs(page.docs, now);
  const bodyType = pageNo === 1 && page.bodyTypes.length ? await applyFamilyBodyType(family, page) : null;

  const totalPages = page.totalPages ?? family.totalPages ?? null;
  const done = page.docs.length === 0 || (totalPages !== null && pageNo >= totalPages);
  await ArabamListSweep.updateOne(
    { key: family.key },
    {
      $set: {
        path,
        total: page.total ?? family.total ?? null,
        totalPages,
        nextPage: done ? 1 : pageNo + 1,
        lastFetchedAt: now,
        ...(bodyType ? { bodyType } : {}),
        ...(done ? { skipUntil: new Date(now.getTime() + LIST_SWEEP.revisitMs), note: "Tüm sayfalar gezildi" } : { note: "" }),
      },
      $inc: { pagesFetched: 1, matched: applied.matched, unverified: -Math.min(applied.matched, family.unverified) },
    }
  );

  const ratioText = page.total ? ` (kaynakta ${page.total.toLocaleString("tr-TR")} ilan)` : "";
  return {
    ...base,
    picked: true,
    requests,
    matched: applied.matched,
    corrected: applied.corrected,
    message:
      `Liste: ${label} s.${pageNo}${totalPages ? `/${totalPages}` : ""}${ratioText}: ${page.docs.length} ilandan ${applied.matched} bizde, ` +
      `${applied.corrected} vites düzeltildi` +
      (applied.priceChanged ? `, ${applied.priceChanged} fiyat güncellendi` : "") +
      (applied.recheck ? `, ${applied.recheck} arşivdeki ilan yeniden kontrole alındı` : "") +
      (bodyType ? `, kasa tipi ${bodyType} yazıldı` : ""),
  };
}
