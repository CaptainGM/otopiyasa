import { turkishSearchRegex } from "@/lib/utils";
import { MODEL_EXTENSIONS } from "@/lib/model-catalog-data";

/**
 * MODEL AİLESİ: kaynaklar aynı modeli donanımıyla ("Juke 1.0 DIG-T Platinum"), büyük harfle
 * ("JUKE") ya da yalnız adıyla ("Juke") yazıyor. Filtrelerde tek bir "Juke" seçeneği gösterilir
 * ve seçilince hepsini bulur. İlan verme formu ve model analizi donanım adıyla çalışmaya devam eder.
 *
 * Kural: motor hacminden (1.3, 2,0) önceki kısmın ilk kelimesi aile adıdır. İstisnalar:
 *  - "3 Serisi", "500 X", "R 12", "ID. Buzz": ilk kelime sayı ya da 1–2 harfse ikinci kelime de alınır;
 *  - "C 180", "GLA 200": harf + 3 haneli sayı "C Serisi" ailesidir; Mercedes/Lexus'ta "C200", "C",
 *    "C-SERISI" de aynı ailedir; BMW'de "320i", "116d" gibi kodlar "3 Serisi", "1 Serisi"dir;
 *  - "Range Rover Evoque", "Corolla Cross", "Grand Cherokee": ayrı araç olan ekler aileye katılır.
 */

/** Tek başına ayrı bir araç anlatan ikinci kelimeler ("Corolla" ile "Corolla Cross" farklı araçtır). */
const DISTINCT_SUFFIXES = ["cross", "aircross", "crossback", "sport", "courier", "custom", "connect", "evoque", "velar", "cruiser", "cherokee", "vitara", "scenic", "fe"];
/** Kendi başına aile adı olmayan ilk kelimeler: bir sonraki kelimeyle birlikte okunur. */
const JOINING_HEADS = ["model", "the", "grand", "grande", "range", "land", "santa", "space"];
/** Harf sınıfıyla adlanan markalar ("C Serisi", "GLA Serisi", "RX Serisi"). */
const CLASS_BRANDS = ["mercedesbenz", "mercedes", "lexus"];

const fold = (s: string) =>
  s.trim().toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "");
const bare = (token: string) => fold(token).replace(/[^\p{L}\p{N}]/gu, "");

const SERIES = "Serisi";
const series = (name: string) => [name, SERIES];

interface Extension {
  tokens: string[];
  /** Harf/rakam dışı karakterleri atılmış, küçük harf, birleşik ("i20n"). */
  joined: string;
  bareTokens: string[];
}

/** Marka → kaynağın ayrı model saydığı adlar (uzun ad önce). Veri: model-catalog-data.ts. */
const EXTENSIONS_BY_BRAND = new Map<string, Extension[]>(
  Object.entries(MODEL_EXTENSIONS).map(([brandKey, names]) => [
    brandKey,
    names
      .map((name) => {
        const tokens = name.split(/\s+/).filter(Boolean);
        const bareTokens = tokens.map(bare);
        return { tokens, bareTokens, joined: bareTokens.join("") };
      })
      .filter((e) => e.tokens.length > 0)
      .sort((a, b) => b.tokens.length - a.tokens.length),
  ])
);

/** Modelin başı kaynağın ayrı model saydığı bir adla ("i20 N") başlıyorsa o adı döndürür. */
function matchExtension(tokens: string[], brandKey: string): string[] | null {
  const list = EXTENSIONS_BY_BRAND.get(brandKey);
  if (!list) return null;
  for (const ext of list) {
    let joined = "";
    for (let k = 0; k < tokens.length; k++) {
      joined += bare(tokens[k]);
      if (joined === ext.joined) return ext.tokens;
      if (joined.length >= ext.joined.length) break;
    }
  }
  return null;
}

/** Bu ailenin başını paylaşan ama daha uzun ayrı modeller ("i20" için "N", "Active", "Troy"): sorgu desenlerinde dışarıda bırakılır. */
function longerExtensions(tokens: string[], brandKey: string): Extension[] {
  const base = tokens.map(bare);
  return (EXTENSIONS_BY_BRAND.get(brandKey) || []).filter(
    (e) => e.bareTokens.length > base.length && base.every((t, i) => e.bareTokens[i] === t)
  );
}

function familyTokens(model?: string | null, brand?: string | null, useExtensions = true): string[] {
  const head = (model || "")
    .trim()
    .split(/\d[.,]\d/)[0]
    // "C-SERISI", "3-Series" → "C SERISI"
    .replace(/-(?=(?:seri̇si|serisi|series|class)(?![\p{L}\p{N}]))/giu, " ");
  // Bazı kayıtlar virgülle birden çok ad taşıyor ("I20,I20N,"): ilki alınır.
  const tokens = head.split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) return [];

  const b = bare(brand || "");
  // Model adı marka adıyla ("DS 7 Crossback", "Mini Cooper") ya da DS'in "Automobiles" ekiyle ("Automobiles 7 Crossback 1.5 BlueHDI")
  // başlıyorsa baştaki kısım atılır; yoksa DS'in tüm modelleri "Automobiles" ailesinde toplanıyordu.
  while (tokens.length > 1 && b && (bare(tokens[0]) === b || (b === "ds" && bare(tokens[0]) === "automobiles"))) tokens.shift();
  // Kaynağın ayrı model saydığı ad ("i20 N", "Ioniq 5"): genel aile kuralından önce bakılır.
  const extension = useExtensions ? matchExtension(tokens, b) : null;
  if (extension) return extension;
  const first = bare(tokens[0]);
  const second = tokens[1] ? bare(tokens[1]) : "";
  const isSeriesWord = /^(serisi|series|class|sinifi)$/.test(second);

  // BMW: "320i", "116d", "525D" → "3 Serisi"
  if (b === "bmw" && /^[1-8]\d{2}[a-z]{1,2}$/.test(first)) return series(first[0]);
  if (CLASS_BRANDS.includes(b)) {
    // "C", "CLA", "C200", "GLA 200 d", "E 63 AMG", "C Serisi" → "C Serisi"
    const cls = first.match(/^([a-z]{1,3})(\d{2,3}[a-z]*)?$/);
    // "GLC 4MATIC" gibi harf-sınıf adları da ("AMG GT" hariç) aynı ailedir.
    if (cls && (cls[2] || first !== "amg")) return series(cls[1].toUpperCase());
  }
  // Genel: "C 180", "GLA 200 d" → "C Serisi"
  if (/^\p{L}{1,3}$/u.test(first) && /^\d{3}[a-z]*$/.test(second)) return series(tokens[0].toUpperCase());
  if (isSeriesWord) return series(tokens[0].toUpperCase());

  const picked = [tokens[0]];
  let i = 1;
  const needsNext = () => {
    if (picked.length !== 1 || i >= tokens.length) return false;
    const last = bare(picked[0]);
    const next = bare(tokens[i]);
    if (JOINING_HEADS.includes(last) || /^\d+$/.test(last)) return true;
    // "R 12", "ID. Buzz" birleşir; "X1 sDrive18i", "iX xDrive40" birleşmez.
    return /^\p{L}{1,2}$/u.test(last) && (/^\d+$/.test(next) || /^\p{L}+$/u.test(next));
  };
  while (needsNext() || (i < tokens.length && picked.length === 2 && JOINING_HEADS.includes(bare(picked[1])))) {
    picked.push(tokens[i++]);
  }
  if (i < tokens.length && DISTINCT_SUFFIXES.includes(bare(tokens[i]))) picked.push(tokens[i]);
  return picked;
}

/** Kaynağın ayrı model listesi OLMADAN genel aile kuralı (veri üretimi için): "i20 N" → "i20". */
export function genericModelFamily(model?: string | null, brand?: string | null): string {
  return familyTokens(model, brand, false).join(" ");
}

/** Bir model adının karşılaştırma anahtarı: aksansız, harf/rakam dışı atılmış küçük harf ("i20 N" → "i20n"). */
export const modelNameKey = (name?: string | null) => bare(name || "");

/** Marka anahtarı (model-catalog-data.ts ile aynı biçim). */
export const catalogBrandKey = (brand?: string | null) => bare(brand || "");

/** Filtrede gösterilecek aile adı ("Qashqai 1.3 DIG-T Sky Pack" → "Qashqai"). */
export function modelFamily(model?: string | null, brand?: string | null): string {
  return familyTokens(model, brand).join(" ");
}

/** Karşılaştırma anahtarı: büyük/küçük harf, ı/i, aksan, tire ve boşluk farkı yok ("C-HR" = "C-hr" = "C HR", "X-Trail" = "X TRAIL"). */
export function modelFamilyKey(model?: string | null, brand?: string | null): string {
  return familyTokens(model, brand).map(bare).join("");
}

/** Aynı ailedeki yazımlardan gösterilecek olanı seçer: karışık harfli olan ("Juke") tamamı büyükten ("JUKE") iyidir. */
function preferLabel(a: string, b: string): string {
  const mixed = (s: string) => s !== s.toLocaleUpperCase("tr-TR");
  if (mixed(a) !== mixed(b)) return mixed(a) ? a : b;
  return a.length <= b.length ? a : b;
}

/** Model listesini aile listesine indirger (sıralı, tekrar yok). */
export function modelFamilies(models: string[], brand?: string | null): string[] {
  const byKey = new Map<string, string>();
  for (const model of models) {
    const key = modelFamilyKey(model, brand);
    if (!key) continue;
    const label = modelFamily(model, brand);
    const current = byKey.get(key);
    byKey.set(key, current ? preferLabel(current, label) : label);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Mongo'nun desen motoru \p{L} sınıfını her sürümde tanımıyor; harf/rakam açıkça yazılır. */
const ALNUM = "0-9A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû";
/** Anahtar aksansız ("sahin"); veritabanındaki yazım "Şahin", "ŞAHİN" olabilir. */
const FOLDED_CLASSES: Record<string, string> = {
  i: "iıİIíî", s: "sşŞ", c: "cçÇ", o: "oöÖóô", u: "uüÜúû", g: "gğĞ", a: "aâÂáàä", e: "eéÉèêë",
};
/** Harfler arasında boşluk, nokta, tire, artı olabilir ("C-HR", "ID. Buzz", "Qashqai+2"). */
const GAP = "[\\s.+/-]*";

const tokenPattern = (token: string) =>
  bare(token)
    .split("")
    .map((ch) => (FOLDED_CLASSES[ch] ? `[${FOLDED_CLASSES[ch]}]` : turkishSearchRegex(ch)))
    .join(GAP);

/**
 * Mongo sorgusu için: aileye ait tüm yazımları bulan desen. Eski bağlantılardaki tam model adı
 * ("Juke 1.0 DIG-T Platinum") da çalışır: aile adı olarak okunur. Aynı ailenin ayrı araç olan
 * kolu ("Corolla" seçiliyken "Corolla Cross") dışarıda kalır.
 */
export function modelFamilyRegex(model: string, brand?: string | null): RegExp {
  const tokens = familyTokens(model, brand);
  if (!tokens.length) return /^$/;
  const b = bare(brand || "");
  const seriesWord = `(?:${tokenPattern("serisi")}|series|class|${tokenPattern("sınıfı")})`;
  let body: string;
  if (tokens.length === 2 && tokens[1] === SERIES) {
    const name = tokenPattern(tokens[0]);
    if (b === "bmw" && /^[1-8]$/.test(tokens[0])) {
      // "3 Serisi 320i", "3 SERİSİ", "320i"
      body = `(?:${name}[\\s-]*${seriesWord}|${name}\\d{2}[a-z]{1,2})`;
    } else if (CLASS_BRANDS.includes(b)) {
      // "C 180", "C200", "C", "C-Serisi"
      body = `${name}(?:[\\s-]*(?:\\d{2,3}[a-z]*|${seriesWord}))?`;
    } else {
      body = `${name}[\\s-]*(?:\\d{3}[a-z]*|${seriesWord})`;
    }
  } else {
    body = tokens.map(tokenPattern).join(GAP);
  }
  const endsWithSuffix = DISTINCT_SUFFIXES.includes(bare(tokens[tokens.length - 1]));
  // Aynı adla başlayan ama kaynağın ayrı model saydığı kollar ("i20" seçiliyken "i20 N") dışarıda kalır.
  const longer = longerExtensions(tokens, b).map((e) => e.tokens.slice(tokens.length).map(tokenPattern).join(GAP));
  const alternatives = [...(endsWithSuffix ? [] : DISTINCT_SUFFIXES), ...longer];
  const excludeSuffix = alternatives.length ? `(?![\\s.+/-]*(?:${alternatives.join("|")})(?![${ALNUM}]))` : "";
  // Ad bitişik yazılmış motor hacmiyle de bitebilir: "QASHQAI1.6DCI".
  // "Qashqai+2" ayrı araçtır ama "206+" 206 ailesindendir: "+" ancak arkasından rakam gelmiyorsa ad sonu sayılır.
  const end = `(?=$|[^${ALNUM}+]|\\+(?![0-9])|\\d[.,]\\d)`;
  return new RegExp(`^\\s*${body}${end}${excludeSuffix}`, "i");
}
