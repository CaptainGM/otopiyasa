import { FilterQuery, SortOrder } from "mongoose";
import { CarFilters } from "@/types";
import { turkishSearchRegex } from "@/lib/utils";
import { Car } from "@/models/Car";
import { normalizeFuelType } from "@/lib/normalize-fuel";
import {
  feedOrderForSeed,
  feedOrderForSlot,
  isMixedSort,
  isValidFeedSlot,
  MAX_FEED_SEED,
  resolveFeedBucket,
  resolveFeedSeed,
} from "@/lib/car-mix";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { LIST_IMAGE_LIMIT } from "@/lib/serialize-car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { brandStorageAliases } from "@/lib/normalize-brand";
import { cityStorageAliases } from "@/lib/normalize-city";
import { modelFamilyRegex } from "@/lib/model-family";
import { normalizeColor } from "@/lib/normalize-color";
import { normalizeTransmission, transmissionMatch } from "@/lib/vehicle-attrs";
import { AUTOMATIC_TRANSMISSION_PATTERN } from "@/lib/transmission-label";
import { isVehicleClass } from "@/lib/vehicle-scope";
import { alnumVariants, brandSplitVariants, buildCandidates, correctSearch, type SearchCandidate } from "@/lib/search-correct";

/** Tam eşleşme bu kadar azsa başka yazımlar ve yarım kelimelerle genişletilir ("bmw 320" tam yalnızca 1 ilan bulur, "320i" 100'den fazla). */
const FEW_RESULTS = 5;

/** Atlas metin aramasının baktığı alanlar. */
const SEARCH_PATHS = ["title", "brand", "model", "city"];

/**
 * Durum-marka-model indeksi. Az ilanın eşleştiği filtrelerde Mongo sıralama indeksini (tarih ya da rastgele) seçip tüm ilanları
 * tarıyordu (3-7 sn); bu ipucuyla yalnızca eşleşenler okunur (~150-450 ms). Sıralama değişmez.
 */
const MODEL_INDEX = { status: 1, brand: 1, model: 1, year: 1 };

/** Bu sayının altında eşleşen filtrelerde ipucu verilir; yoğun sonuçlarda Mongo'nun kendi planı hızlıdır (sıralama indeksi erken biter). */
const NARROW_TOTAL = 1000;

function withNarrowHint<Q extends { hint: (hint: object) => unknown }>(query: Q, narrow: boolean): Q {
  if (narrow) query.hint(MODEL_INDEX);
  return query;
}

/** Önek eşleşmesinde joker karakterler ("*", "?") kullanıcı yazdıysa etkisizleştirilir. */
const escapeWildcard = (token: string) => token.replace(/[\\*?]/g, "\\$&");

/** Aranan metnin her kelimesi bir önekle eşleşsin ("bmw 320" → "320i"); 3 harften kısa kelimeler tam eşleşir. */
function prefixClauses(text: string): Record<string, unknown>[] {
  const tokens = text.replace(/İ/g, "i").toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.some((token) => token.length >= 3)) return [];
  return [
    {
      compound: {
        must: tokens.map((token) =>
          token.length >= 3
            ? { wildcard: { query: `${escapeWildcard(token)}*`, path: SEARCH_PATHS, allowAnalyzedField: true } }
            : { text: { query: token, path: SEARCH_PATHS } }
        ),
      },
    },
  ];
}

/**
 * Harf ve rakamları tek tek aralıklı yazılmış kelimeleri birleştirir: "b m w 3 2 0 i" → "bmw320i", "M a z d a 3 2 3" → "Mazda323",
 * "C h e v r o l e t A v e o 1 . 4 L T" → "ChevroletAveo 1.4 LT". Motor hacmi ("1 . 6" → "1.6") ondalıklı kalır; ondalık
 * sayının rakamı harfle birleşmez ("3 2 3 1.5" içinde "1" motor hacmine aittir).
 */
export function collapseSpacedLetters(text: string): string {
  return text
    .replace(/(\d)\s*\.\s*(\d)/g, "$1.$2")
    // Ondalığın rakamından ("1.6 D") ya da harfle bitişik rakamdan (ör. "a3") başlayan dizi birleşmez.
    .replace(/(?<![\p{L}\p{N}.,])(?:[\p{L}\p{N}] ){1,}[\p{L}\p{N}](?![\p{L}\p{N}]|[.,]\p{N})/gu, (run) => run.replace(/ /g, ""));
}

/**
 * Her kelime tam ya da önek olarak aranır, bulanık eşleşme yok ("honda civi" → Civic). Bulanık arama kısmi kelimeyi yanlış
 * ilanlara bağlıyordu ("civi" ~ "crv", 30 CR-V). Kelime 3 harften kısaysa yalnız tam eşleşir.
 */
function exactOrPrefixQuery(text: string): Record<string, unknown> {
  const tokens = text.replace(/İ/g, "i").toLowerCase().split(/\s+/).filter(Boolean);
  return {
    compound: {
      must: tokens.map((token) => {
        // "all": "mercedes-benzeqa" gibi tireli bir belirteç analizde parçalanır; parçalardan biri tutsa yetmesin (varsayılan "any").
        const exact = { text: { query: token, path: SEARCH_PATHS, matchCriteria: "all" } };
        if (token.length < 3) return exact;
        const prefix = { wildcard: { query: `${escapeWildcard(token)}*`, path: SEARCH_PATHS, allowAnalyzedField: true } };
        return { compound: { should: [exact, prefix], minimumShouldMatch: 1 } };
      }),
    },
  };
}

/** Bir sayfa sonuç. correction: aranan metin hiçbir ilanda tutmadığı için yazım düzeltmesiyle bulunan sonuçlarda dolar. */
export interface CarsPage {
  docs: unknown[];
  total: number;
  page: number;
  limit: number;
  correction?: { from: string; label: string };
}

/**
 * Atlas metin araması ayarları. Yazım toleransı (1 harf fark) yalnızca düz kelimelerde açık: "i30" ile "i20", "3008" ile "3006" tek
 * harf farkı yüzünden birbirinin yerine geçiyordu. Rakam içeren ya da 5 harften kısa aramalarda tam eşleşme kullanılır.
 */
export function textSearchOptions(term: string, matchCriteria: "all" | "any" = "all"): Record<string, unknown> {
  // "all": aranan kelimelerin HEPSİ ilanda geçmeli ("galeriden bmw 520i" yalnızca galeriden 520i ilanlarını getirir). Atlas varsayılanı
  // "any"dir: tek bir kelime tutsa yeter, bu yüzden başka satıcıların ilanları da aramaya girerdi.
  const text: Record<string, unknown> = { query: term, path: SEARCH_PATHS, matchCriteria };
  if (term.length >= 5 && !/\d/.test(term)) text.fuzzy = { maxEdits: 1, prefixLength: 1 };
  return text;
}

export function buildCarQuery(filters: CarFilters): FilterQuery<unknown> {
  
  const query: FilterQuery<unknown> = { ...PUBLIC_LISTING_FILTER };

  if (filters.q?.trim()) {
    
    const search = turkishSearchRegex(filters.q.trim());
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
    ];
  }

  if (filters.brand) {
    query.brand = {
      $in: brandStorageAliases(filters.brand).map((brand) =>
        new RegExp(`^${turkishSearchRegex(brand)}$`, "i")
      ),
    };
  }
  // Model ailesi: "Juke" seçilince "JUKE" ve "Juke 1.0 DIG-T Platinum" de gelir (bkz. model-family.ts).
  if (filters.model) query.model = modelFamilyRegex(filters.model, filters.brand);
  if (filters.city) query.city = { $in: cityStorageAliases(filters.city) };

  
  if (filters.color) {
    query["features.color"] = {
      $regex: `^${turkishSearchRegex(normalizeColor(filters.color))}$`,
      $options: "i",
    };
  }
  // Mobil "LPG" gönderiyor, kayıtlar "LPG & Benzin"; ikisi de aynı yazıma çevrilir.
  if (filters.fuelType) query["features.fuelType"] = normalizeFuelType(filters.fuelType);
  if (filters.transmission) {
    // Alıcı için "Yarı Otomatik" de otomatiktir (bkz. transmission-label.ts): ikisi de "Otomatik" filtresinde gelir.
    const kind = normalizeTransmission(filters.transmission);
    query["features.transmission"] =
      kind === "Otomatik" || kind === "Yarı Otomatik"
        ? { $regex: AUTOMATIC_TRANSMISSION_PATTERN, $options: "i" }
        : transmissionMatch(filters.transmission);
  }
  // Araç tipi: tipi henüz yazılmamış eski kayıtlar otomobil sayılır.
  if (filters.vehicleClass) {
    query.vehicleClass = filters.vehicleClass === "otomobil" ? { $in: ["otomobil", null] } : filters.vehicleClass;
  }

  if (filters.yearMin || filters.yearMax) {
    query.year = {};
    if (filters.yearMin) query.year.$gte = filters.yearMin;
    if (filters.yearMax) query.year.$lte = filters.yearMax;
  }

  if (filters.priceMin || filters.priceMax) {
    query.price = {};
    if (filters.priceMin) query.price.$gte = filters.priceMin;
    if (filters.priceMax) query.price.$lte = filters.priceMax;
  }

  if (filters.mileageMin || filters.mileageMax) {
    query.mileage = {};
    if (filters.mileageMin) query.mileage.$gte = filters.mileageMin;
    if (filters.mileageMax) query.mileage.$lte = filters.mileageMax;
  }

  if (filters.seller) {
    // Kaynak başlıkları satıcıyı önekle belirtir; bireysel satış için önek, filtre adında geçmeden kullanılır.
    const prefix = filters.seller === "galeriden" ? "galeriden" : "sahibinden";
    (query.$and ||= []).push({ title: { $regex: `^\\s*${prefix}\\b`, $options: "i" } });
  }

  if (filters.noDamage) query.damageFlag = { $ne: true };

  if (filters.deals) {
    query["market.deal"] = true;
  }

  if (filters.excludeOutliers) {
    query["market.outlier"] = { $ne: true };
  }

  if (filters.discountOnly) {
    (query.$and ||= []).push({
      $expr: {
        $and: [
          { $gt: [{ $size: { $ifNull: ["$priceHistory", []] } }, 1] },
          { $gt: [{ $arrayElemAt: ["$priceHistory.price", 0] }, "$price"] },
        ],
      },
    });
  }

  return query;
}

export function buildCarSort(sort?: CarFilters["sort"]): Record<string, SortOrder> {
  switch (sort) {
    case "price_asc":
      return { price: 1 as SortOrder };
    case "price_desc":
      return { price: -1 as SortOrder };
    case "year_desc":
      return { year: -1 as SortOrder };
    case "views":
     
      return { viewCount: -1 as SortOrder };
    case "deal":
      // Adil değerin altındaki indirim, emsal güveniyle tartılmış puana göre (bkz. lib/market-fair.ts dealScore).
      return { "market.dealScore": -1 as SortOrder, _id: 1 as SortOrder };
    case "newest":
    default:
      return { createdAt: -1 as SortOrder };
  }
}


/** Filtreye uyan toplam ilan sayısı (Keşfet başlığı için; kısa süre önbellekte). */
export async function countCars(filters: CarFilters): Promise<number> {
  const query = buildCarQuery(filters);
  return cached(`count:${JSON.stringify(query)}`, CACHE_TTL.short, () => Car.countDocuments(query));
}

export async function findCarsPage(input: CarFilters): Promise<CarsPage> {
  const text = input.q?.trim();
  const collapsed = text ? collapseSpacedLetters(text) : text;
  if (!text || collapsed === text) return searchCarsPage(input);
  const page = await searchCarsPage({ ...input, q: collapsed });
  if (page.total > 0) return page;
  // Birleştirme sonucu bozduysa ("YamahaYZFR25") özgün metinle de dene: marka ayrımı boşluklu metinde çalışır.
  return searchCarsPage(input);
}

async function searchCarsPage(filters: CarFilters): Promise<CarsPage> {
  // Varsayılan ana akışta tüm sayfalar aynı güncel sıralamayı kullanmalı;
  // ilk sayfa ile devam sayfalarını farklı sıralamak ilan tekrarına yol açar.
  const isDefaultHome =
    !filters.q &&
    !filters.brand &&
    !filters.model &&
    !filters.city &&
    !filters.color &&
    !filters.yearMin &&
    !filters.yearMax &&
    !filters.priceMin &&
    !filters.priceMax &&
    !filters.mileageMin &&
    !filters.mileageMax &&
    !filters.seller &&
    !filters.noDamage &&
    !filters.fuelType &&
    !filters.transmission &&
    !filters.discountOnly &&
    !filters.deals &&
    (!filters.sort || filters.sort === "mixed");

  // Rastgele akış her tohumda farklıdır; önbelleğe alınırsa kayıtlar boşuna birikir ve herkes
  // aynı sırayı görürdü. Sorgu zaten indeksli ve milisaniyeler sürüyor.
  if (isDefaultHome || (isMixedSort(filters.sort) && !filters.q?.trim())) {
    if ((filters.page || 1) === 1 && isValidFeedSlot(filters.slot)) {
      const bucket = resolveFeedBucket(filters.bucket);
      const slotKey = `feed:s${filters.slot}:b${bucket}:l${filters.limit || 24}:vc${filters.vehicleClass || "all"}`;
      return cached(slotKey, 15 * 60 * 1000, () => findCarsPageUncached(filters));
    }
    return findCarsPageUncached(filters);
  }

  const key = `cars:${JSON.stringify(filters)}`;
  return cached(key, CACHE_TTL.short, () => findCarsPageUncached(filters));
}

async function findCarsPageUncached(
  filters: CarFilters
): Promise<CarsPage> {
  const query = buildCarQuery(filters);
  const page = filters.page || 1;
  const limit = filters.limit || 12;
  const skip = (page - 1) * limit;

  // Keşfet, rastgele rank indeksinde tohuma ait pivot noktasından döngüsel ilerler.
  // Aynı tohum tüm sayfalarda kaldığı için sayfalama kayıt atlamaz veya yinelemez.
  // Arama metni varsa alaka sırası korunur (aşağıdaki arama yolu).
  if (isMixedSort(filters.sort) && !filters.q?.trim()) {
    const { field, direction, pivot } = isValidFeedSlot(filters.slot)
      ? feedOrderForSlot(filters.slot, resolveFeedBucket(filters.bucket))
      : feedOrderForSeed(resolveFeedSeed(filters.seed));
    const tailCondition = direction === 1 ? { $gte: pivot } : { $lte: pivot };
    const headCondition = direction === 1 ? { $lt: pivot } : { $gt: pivot };
    const tailQuery: FilterQuery<unknown> = { $and: [query, { [field]: tailCondition }] };
    const headQuery: FilterQuery<unknown> = { $and: [query, { [field]: headCondition }] };
    const sort = { [field]: direction };
    // Toplam sayı tohumdan bağımsız: aynı filtre için kısa süre önbellekte (her sayfada 27 bin kaydı saymasın).
    const countPromise = cached(`count:${JSON.stringify(query)}`, CACHE_TTL.short, () => Car.countDocuments(query));
    const tailCountPromise = page > 1 ? Car.countDocuments(tailQuery) : Promise.resolve(0);
    const [total, tailCount] = await Promise.all([countPromise, tailCountPromise]);
    const offset = skip;

    let docs: unknown[];
    if (page === 1 || offset < tailCount) {
      const tailSkip = page === 1 ? 0 : offset;
      const tailDocs = await withNarrowHint(
        Car.find(tailQuery).sort(sort).skip(tailSkip).limit(limit).slice("images", LIST_IMAGE_LIMIT),
        total <= NARROW_TOTAL
      ).lean();
      docs = tailDocs as unknown[];
      if (docs.length < limit) {
        const headDocs = await withNarrowHint(
          Car.find(headQuery).sort(sort).limit(limit - docs.length).slice("images", LIST_IMAGE_LIMIT),
          total <= NARROW_TOTAL
        ).lean();
        docs.push(...(headDocs as unknown[]));
      }
    } else {
      docs = (await withNarrowHint(
        Car.find(headQuery).sort(sort).skip(offset - tailCount).limit(limit).slice("images", LIST_IMAGE_LIMIT),
        total <= NARROW_TOTAL
      ).lean()) as unknown[];
    }
    return { docs: docs as unknown[], total, page, limit };
  }

  // 1. MongoDB Atlas Search (Lucene Engine):
  // Typo-tolerance (volksvagen -> Volkswagen), kelime kökü analizi ve alaka düzeyi (relevance)
  if (filters.q?.trim()) {
    try {
      const searchTerm = filters.q.trim();
      const filtersWithoutQ = { ...filters, q: undefined };
      const matchFilter = buildCarQuery(filtersWithoutQ);

      // Önce aranan kelimelerin hepsini içerenler; hiçbiri yoksa başka yazımlar, yazım düzeltmesi ve en az birini içerenler (aşağıdaki basamaklar).
      const buildPipeline = (search: Record<string, unknown>) => {
        const stages: any[] = [
          { $search: { index: "default", ...search } },
          { $match: matchFilter },
        ];
        // Kullanıcı belirli bir sıralama seçtiyse uygula (seçmediyse Lucene alaka puanına göre sıralanır)
        if (filters.sort && filters.sort !== "mixed") stages.push({ $sort: buildCarSort(filters.sort) });
        stages.push({
          $facet: {
            docs: [
              { $skip: skip },
              { $limit: limit },
              { $addFields: { images: { $slice: ["$images", LIST_IMAGE_LIMIT] } } },
            ],
            totalCount: [{ $count: "count" }],
          },
        });
        return stages;
      };
      const runSearch = async (search: Record<string, unknown>) => {
        const [facetResult] = await Car.aggregate(buildPipeline(search));
        return { docs: facetResult?.docs || [], total: facetResult?.totalCount?.[0]?.count || 0 };
      };
      const runAtlas = (criteria: "all" | "any") => runSearch({ text: textSearchOptions(searchTerm, criteria) });
      /** exactTexts'in kelimelerinin hepsini içerenler ile prefixTexts'in her kelimesini önekle eşleyenlerin birleşimi. */
      const runUnion = async (exactTexts: string[], prefixTexts: string[]) => {
        const should = [...exactTexts.map((text) => ({ text: textSearchOptions(text, "all") })), ...prefixTexts.flatMap(prefixClauses)];
        if (should.length === 0) return { docs: [] as unknown[], total: 0 };
        return runSearch({ compound: { should, minimumShouldMatch: 1 } }).catch(() => ({ docs: [] as unknown[], total: 0 }));
      };
      // Önce kelimelerin tam ya da önek eşleşmesi; en az FEW_RESULTS ilan dönerse bulanık aramaya gerek yok ("corola" gibi
      // yazım hatalarında bu aşama az sonuç verir ve bulanık arama devreye girer).
      const wordsFirst = runSearch(exactOrPrefixQuery(searchTerm)).catch(() => ({ docs: [] as unknown[], total: 0 }));
      const fuzzyFirst = runAtlas("all");
      fuzzyFirst.catch(() => {});
      const wordsResult = await wordsFirst;
      if (wordsResult.total >= FEW_RESULTS) return { ...wordsResult, page, limit };
      let result = await fuzzyFirst;
      if (result.total < FEW_RESULTS) {
        // Az sonuç ya da hiç yok. Aşağıdaki adaylar birbirinden bağımsız: sırayla çalıştırılınca yazım düzeltmesi gereken aramalar
        // 3-10 sn sürüyordu. Hepsi birlikte hesaplanır, sonuç yine ÖNCELİK sırasıyla seçilir (aşağıdaki numaralar):
        // 1. Aynı model kodunun başka yazımı ("c180" / "c 180") ve yarım yazılmış kelimeler ("bmw 320" → 320i).
        // 2. Boşluksuz yazılmış "marka + model" ("bmw320i" → "BMW 320i"): markayı ayırıp yeniden ara.
        // 3. Marka/model sözlüğüne göre yazım düzeltmesi ("cherytigo7pro" → Chery Tiggo 7 Pro); sıkı, sonra gevşek.
        // 4. Çok kelimeli aramada en az bir kelimeyi içeren ilanlar.
        const variants = alnumVariants(searchTerm);
        const alternativePromise = runUnion(variants, [searchTerm, ...variants]);
        const none = result.total === 0;
        const brands = none ? await searchBrands(filters.vehicleClass) : [];
        const splitPromises = none
          ? brandSplitVariants(searchTerm, brands).map((text) => {
              const texts = [text, ...alnumVariants(text)];
              return runUnion(texts, texts).then((split) => ({ text, split }));
            })
          : [];
        const strictPromise = none ? correctedPage(filters, skip, limit, true) : Promise.resolve(null);
        const loosePromise = none ? correctedPage(filters, skip, limit, false) : Promise.resolve(null);
        const anyPromise =
          none && searchTerm.split(/\s+/).length > 1 ? runAtlas("any").catch(() => null) : Promise.resolve(null);

        const alternative = await alternativePromise;
        if (alternative.total > result.total) return { ...alternative, page, limit };
        if (none) {
          for (const pending of splitPromises) {
            const { text, split } = await pending;
            if (split.total > 0) return { ...split, page, limit, correction: { from: searchTerm, label: text } };
          }
          const strict = await strictPromise;
          if (strict) return strict;
          const loose = await loosePromise;
          if (loose) return loose;
          const any = await anyPromise;
          if (any) result = any;
        }
      }
      const { docs, total } = result;
      return { docs, total, page, limit };
    } catch {
      // Atlas Search desteklenmiyorsa (örn. yerel mock testler) standart $regex aramasına devam eder
    }
  }

  // Önce sayılır: seyrek sonuçta sıralama indeksine değil marka/model indeksine ipucu verilsin (bkz. withNarrowHint).
  const total = await Car.countDocuments(query);
  const docs = await withNarrowHint(
    Car.find(query).sort(buildCarSort(filters.sort)).skip(skip).limit(limit).slice("images", LIST_IMAGE_LIMIT),
    total <= NARROW_TOTAL
  ).lean();
  if (total === 0 && filters.q?.trim()) {
    // Atlas Search yokken (yerel/test ortamı) de aynı yazım düzeltmesi çalışsın.
    const corrected = (await correctedPage(filters, skip, limit, true)) ?? (await correctedPage(filters, skip, limit, false));
    if (corrected) return corrected;
  }
  return { docs: docs as unknown[], total, page, limit };
}

const candidateCache = new WeakMap<object, SearchCandidate[]>();

/**
 * Marka/model seçenekleri (15 dk önbellekli). Veritabanı bağlantısını yükleyen modül yalnızca burada, gerektiğinde içe aktarılır:
 * statik içe aktarma, ortam değişkeni olmayan test ortamında car-query'yi yüklenemez kılıyordu.
 */
async function brandModelOptions(vehicleClass?: string) {
  const { getBrandModelOptions } = await import("@/lib/brand-models");
  return getBrandModelOptions(vehicleClass);
}

const searchBrands = (vehicleClass?: string) => brandModelOptions(vehicleClass).then((options) => options.brands, () => [] as string[]);

/** Marka/model sözlüğü; seçenek nesnesi aynı kaldıkça girdiler yeniden üretilmez. */
async function searchCandidates(vehicleClass?: string): Promise<SearchCandidate[]> {
  const options = await brandModelOptions(vehicleClass);
  let candidates = candidateCache.get(options.brandFamilies);
  if (!candidates) {
    candidates = buildCandidates(options.brandFamilies);
    candidateCache.set(options.brandFamilies, candidates);
  }
  return candidates;
}

/** Düzeltilen eşleşmenin marka/model koşulu (buildCarQuery'deki marka ve model ailesi mantığıyla aynı). */
function candidateClause(candidate: SearchCandidate): FilterQuery<unknown> {
  const clause: FilterQuery<unknown> = {};
  if (candidate.kind !== "family" && candidate.brand) {
    clause.brand = { $in: brandStorageAliases(candidate.brand).map((brand) => new RegExp(`^${turkishSearchRegex(brand)}$`, "i")) };
  }
  if (candidate.family) clause.model = modelFamilyRegex(candidate.family, candidate.brand);
  return clause;
}

/**
 * Aranan metin hiçbir ilanda tutmadığında yazım düzeltmesiyle bulunan sonuçlar ("cherytigo7pro" → Chery Tiggo 7 Pro). Düzeltme
 * bulunamazsa ya da sonuç yine boşsa null döner. strict: aranan metindeki her kelime açıklanabiliyorsa düzeltir (bkz. search-correct.ts).
 * Gevşek modda açıklanamayan kelimeler başlıkta aranır; onlarla sonuç çıkmazsa yalnızca model gösterilir.
 */
async function correctedPage(filters: CarFilters, skip: number, limit: number, strict: boolean): Promise<CarsPage | null> {
  try {
    const from = filters.q?.trim() ?? "";
    const found = correctSearch(from, await searchCandidates(filters.vehicleClass), { strict });
    if (!found) return null;
    const base = buildCarQuery({
      ...filters,
      q: undefined,
      fuelType: found.fuelType ?? filters.fuelType,
      transmission: found.transmission ?? filters.transmission,
      yearMin: found.year ?? filters.yearMin,
      yearMax: found.year ?? filters.yearMax,
    });
    const clauses = found.matches.map(candidateClause);
    const modelClause = clauses.length === 1 ? clauses[0] : { $or: clauses };
    const extra = found.extraWords.map((word) => ({ title: { $regex: turkishSearchRegex(word), $options: "i" } }));
    const run = async (withExtra: boolean) => {
      const query: FilterQuery<unknown> = { $and: [base, modelClause, ...(withExtra ? extra : [])] };
      const [docs, total] = await Promise.all([
        // Sıralama tarihe göre kalır; ipucu olmadan Mongo tarih indeksini seçip seyrek eşleşmede tüm ilanları tarıyordu (3,8 sn).
        Car.find(query).sort(buildCarSort(filters.sort)).skip(skip).limit(limit).slice("images", LIST_IMAGE_LIMIT).hint(MODEL_INDEX).lean(),
        Car.countDocuments(query),
      ]);
      return { docs: docs as unknown[], total };
    };
    // Ek kelimeli ve kelimesiz sorgu birlikte koşar (ardışık olsaydı her biri tüm ilanları tarar, süre iki katına çıkardı).
    const [withExtra, withoutExtra] = await Promise.all([extra.length > 0 ? run(true) : null, run(false)]);
    const result = withExtra && withExtra.total > 0 ? withExtra : withoutExtra;
    const correction = { from, label: found.label };
    if (result.total === 0) {
      // Model bulundu ama yakıt/vites/yıl filtresiyle ilan yok ("Tiggo 7 Pro dizel"): alakasız sonuç yerine boş sonuç gösterilir.
      const filtered = !!(found.fuelType || found.transmission || found.year);
      return filtered ? { docs: [], total: 0, page: filters.page || 1, limit, correction } : null;
    }
    return { ...result, page: filters.page || 1, limit, correction };
  } catch {
    return null;
  }
}


const MAX_PAGE_SIZE = 48;

const MAX_QUERY_LEN = 100;

export function parseCarFilters(searchParams: URLSearchParams): CarFilters {
  const num = (key: string) => {
    const value = searchParams.get(key);
    return value ? Number(value) : undefined;
  };

  
  const clampInt = (value: number | undefined, max: number, fallback: number) => {
    
    if (value === undefined || !Number.isFinite(value) || value < 1) return fallback;
    return Math.min(max, Math.trunc(value));
  };

  return {
    q: searchParams.get("q")?.slice(0, MAX_QUERY_LEN) || undefined,
    brand: searchParams.get("brand") || undefined,
    model: searchParams.get("model") || undefined,
    city: searchParams.get("city") || undefined,
    color: searchParams.get("color") || undefined,
    yearMin: num("yearMin"),
    yearMax: num("yearMax"),
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
    mileageMin: num("mileageMin"),
    mileageMax: num("mileageMax"),
    seller: searchParams.get("seller") === "galeriden" || searchParams.get("seller") === "bireysel" ? (searchParams.get("seller") as "galeriden" | "bireysel") : undefined,
    noDamage: searchParams.get("noDamage") === "true",
    fuelType: searchParams.get("fuelType") || undefined,
    transmission: searchParams.get("transmission") || undefined,
    vehicleClass: isVehicleClass(searchParams.get("vehicleClass")) ? (searchParams.get("vehicleClass") as string) : undefined,
    excludeOutliers: searchParams.get("excludeOutliers") === "true",
    discountOnly: searchParams.get("discountOnly") === "true",
    deals: searchParams.get("firsat") === "1",
    // Fırsat listesi kendi sırasıyla gelir (karışık akış değil): en çok piyasa altında olan önce.
    sort:
      searchParams.get("firsat") === "1" && (!searchParams.get("sort") || searchParams.get("sort") === "mixed")
        ? "deal"
        : (searchParams.get("sort") as CarFilters["sort"]) || "mixed",
    seed: clampInt(num("seed"), MAX_FEED_SEED, 0) || undefined,
    slot: searchParams.has("slot") && Number.isInteger(num("slot")) ? num("slot") : undefined,
    bucket: searchParams.has("b") && Number.isInteger(num("b")) ? num("b") : undefined,
    page: clampInt(num("page"), 100_000, 1),
    limit: clampInt(num("limit"), MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}
