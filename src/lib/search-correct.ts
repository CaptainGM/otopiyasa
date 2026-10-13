/**
 * Arama yazım düzeltmesi. Aranan metin hiçbir ilanda tam tutmadığında ("cherytigo7pro", "bmw320", "corola") marka ve model
 * aileleri sözlüğündeki en yakın yazımı bulur. Bitişik yazım (boşluksuz), bir iki harf hatası ve yarım model adı tolere edilir.
 * Rakamlar korunur: "i30" ile "i20", "3008" ile "2008" karışmaz. Saf işlevler; veritabanına dokunmaz.
 */

export type CandidateKind = "brand-family" | "family" | "brand";

export interface SearchCandidate {
  kind: CandidateKind;
  brand?: string;
  family?: string;
  /** Kullanıcıya gösterilen ad: "Chery Tiggo 7 Pro". */
  label: string;
  /** Boşluksuz, sadeleşmiş eşleştirme anahtarı: "cherytiggo7pro". */
  key: string;
}

/** Küçük harf, Türkçe harfler ve aksanlar sadeleşir; boşluk ve işaretler atılır: "Chery Tiggo 7 Pro" → "cherytiggo7pro". */
export function compactKey(text: string): string {
  return (text || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Marka, aile ve "marka aile" olarak üç ayrı sözlük girdisi üretir (kullanıcı hangisini yazarsa yazsın bulunsun). */
export function buildCandidates(brandFamilies: Record<string, string[]>): SearchCandidate[] {
  const out: SearchCandidate[] = [];
  const seenFamilies = new Set<string>();
  for (const [brand, families] of Object.entries(brandFamilies)) {
    const brandKey = compactKey(brand);
    if (brandKey.length >= 3) out.push({ kind: "brand", brand, label: brand, key: brandKey });
    for (const family of families) {
      const familyKey = compactKey(family);
      if (!familyKey) continue;
      out.push({ kind: "brand-family", brand, family, label: `${brand} ${family}`, key: brandKey + familyKey });
      if (familyKey.length >= 3 && !seenFamilies.has(familyKey)) {
        seenFamilies.add(familyKey);
        out.push({ kind: "family", brand, family, label: family, key: familyKey });
      }
    }
  }
  return out;
}

/** Rakam içeren her düzeltme bu kadar pahalı sayılır: bir iki harf hatası tolere edilir, rakam değişimi edilmez. */
const DIGIT_EDIT = 3;
const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const editCost = (ch: string) => (isDigit(ch) ? DIGIT_EDIT : 1);

/** Yazım hatası payı: kısa aramada 0 (tam eşleşme), orta uzunlukta 1, uzun aramada 2 harf. */
export function maxEdits(length: number): number {
  if (length <= 3) return 0;
  return length <= 8 ? 1 : 2;
}

/**
 * q ile c arasındaki uzaklık: full = c'nin tamamıyla, prefix = c'nin herhangi bir önekiyle (yarım model adı) en iyi eşleşme.
 * Harf ekleme/silme/değiştirme ve komşu harf yer değiştirme 1, rakam içeren her düzeltme 3 puandır. Bütçe aşılırsa Infinity.
 */
export function editDistances(q: string, c: string, budget: number): { full: number; prefix: number } {
  const m = q.length;
  const n = c.length;
  if (n + budget < m) return { full: Infinity, prefix: Infinity };
  const width = n + 1;
  const d = new Array<number>((m + 1) * width).fill(0);
  for (let j = 1; j <= n; j++) d[j] = d[j - 1] + editCost(c[j - 1]);
  let previousRowMin = 0;
  for (let i = 1; i <= m; i++) {
    const row = i * width;
    d[row] = d[row - width] + editCost(q[i - 1]);
    let rowMin = d[row];
    for (let j = 1; j <= n; j++) {
      const same = q[i - 1] === c[j - 1];
      const substitute = d[row - width + j - 1] + (same ? 0 : isDigit(q[i - 1]) || isDigit(c[j - 1]) ? DIGIT_EDIT : 1);
      let best = Math.min(substitute, d[row - width + j] + editCost(q[i - 1]), d[row + j - 1] + editCost(c[j - 1]));
      if (i > 1 && j > 1 && q[i - 1] === c[j - 2] && q[i - 2] === c[j - 1] && q[i - 1] !== q[i - 2]) {
        best = Math.min(best, d[row - 2 * width + j - 2] + (isDigit(q[i - 1]) || isDigit(q[i - 2]) ? DIGIT_EDIT : 1));
      }
      d[row + j] = best;
      if (best < rowMin) rowMin = best;
    }
    // Komşu harf yer değiştirme bir satırı atlayabildiği için iki ardışık satırın ikisi de bütçeyi aşınca bırakılır.
    if (rowMin > budget && previousRowMin > budget) return { full: Infinity, prefix: Infinity };
    previousRowMin = rowMin;
  }
  let prefix = Infinity;
  const last = m * width;
  for (let j = 0; j <= n; j++) if (d[last + j] < prefix) prefix = d[last + j];
  return { full: d[last + n], prefix };
}

/**
 * Aynı model kodunun başlıklardaki iki yazımı: harf-rakam sınırında ayrılmış ("c180" → "c 180", "320i" → "320 i") ve bitiştirilmiş
 * ("c 180" → "c180", "320 i" → "320i"). Başlıklar ikisini de kullanıyor ("C 180" ve "C180"); yalnızca farklı olanlar döner.
 */
export function alnumVariants(query: string): string[] {
  const text = query.trim();
  if (!text) return [];
  const split = text.replace(/(\p{L})(\d)/gu, "$1 $2").replace(/(\d)(\p{L})/gu, "$1 $2");
  const tokens = text.split(/\s+/);
  const joined: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const next = tokens[i + 1];
    const pair =
      next !== undefined &&
      ((/^\p{L}{1,2}$/u.test(tokens[i]) && /^\d{1,4}$/.test(next)) || (/^\d{2,4}$/.test(tokens[i]) && /^\p{L}{1,2}$/u.test(next)));
    if (pair) {
      joined.push(tokens[i] + next);
      i += 1;
    } else {
      joined.push(tokens[i]);
    }
  }
  const seen = new Set([text.toLocaleLowerCase("tr-TR")]);
  const out: string[] = [];
  for (const variant of [split, joined.join(" ")]) {
    const key = variant.toLocaleLowerCase("tr-TR");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(variant);
    }
  }
  return out;
}

/** Marka adı ve (çok kelimeli markada) ilk kelimesi: "Mercedes-Benz" ve "Mercedes"; kullanıcı çoğunlukla ikincisini yazar. */
function brandKeys(brands: string[]): Array<{ text: string; key: string }> {
  const out: Array<{ text: string; key: string }> = [];
  for (const brand of brands) {
    const key = compactKey(brand);
    if (key.length >= 3) out.push({ text: brand, key });
    const first = brand.split(/[\s-]+/)[0];
    const firstKey = compactKey(first);
    if (first !== brand && firstKey.length >= 5 && firstKey !== key) out.push({ text: first, key: firstKey });
  }
  return out;
}

/**
 * Boşluksuz yazılmış "marka + model" metninde markayı ayırır: "bmw320i" → "BMW 320i", "mercedesc180" → "Mercedes-Benz c180".
 * Marka adındaki tek harf hatası tolere edilir (5+ harfli markalarda); arkada model parçası kalmalıdır.
 */
export function brandSplitVariants(query: string, brands: string[]): string[] {
  const compact = compactKey(query);
  if (compact.length < 5) return [];
  let best: { brand: string; rest: string; distance: number; keyLength: number } | null = null;
  for (const { text: brand, key } of brandKeys(brands)) {
    const budget = key.length >= 5 ? 1 : 0;
    for (const length of [key.length, key.length - 1, key.length + 1]) {
      if (length < 3 || length >= compact.length) continue;
      const distance = editDistances(compact.slice(0, length), key, budget).full;
      if (distance > budget) continue;
      if (!best || distance < best.distance || (distance === best.distance && key.length > best.keyLength)) {
        best = { brand, rest: compact.slice(length), distance, keyLength: key.length };
      }
    }
  }
  return best ? [`${best.brand} ${best.rest}`] : [];
}

const MAX_MATCHES = 12;
const MAX_TOKENS = 5;
const MIN_QUERY_LENGTH = 3;

interface Match {
  matches: SearchCandidate[];
  distance: number;
}

/** q'ya en yakın sözlük girdileri: önce tam eşleşme (en küçük uzaklık), yoksa önek eşleşmesi. */
export function bestMatches(q: string, candidates: SearchCandidate[]): Match | null {
  const budget = maxEdits(q.length);
  let bestFull = Infinity;
  let bestPrefix = Infinity;
  let full: SearchCandidate[] = [];
  let prefix: SearchCandidate[] = [];
  for (const candidate of candidates) {
    const { full: df, prefix: dp } = editDistances(q, candidate.key, budget);
    if (df <= budget) {
      if (df < bestFull) {
        bestFull = df;
        full = [];
      }
      if (df === bestFull) full.push(candidate);
    }
    if (dp <= budget && q.length >= 4) {
      if (dp < bestPrefix) {
        bestPrefix = dp;
        prefix = [];
      }
      if (dp === bestPrefix) prefix.push(candidate);
    }
  }
  if (full.length > 0 && full.length <= MAX_MATCHES) return { matches: full, distance: bestFull };
  if (full.length === 0 && prefix.length > 0 && prefix.length <= MAX_MATCHES) return { matches: prefix, distance: bestPrefix };
  return null;
}

const FUEL_WORDS: Record<string, string> = {
  dizel: "Dizel",
  benzin: "Benzin",
  lpg: "LPG",
  hibrit: "Hibrit",
  hybrid: "Hibrit",
  elektrik: "Elektrik",
  elektrikli: "Elektrik",
};
const TRANSMISSION_WORDS: Record<string, string> = { otomatik: "Otomatik", manuel: "Manuel" };

export interface SearchCorrection {
  matches: SearchCandidate[];
  /** Aranan metinde yazılmış yakıt, vites ve yıl: eşleşen modelin üstüne filtre olur. */
  fuelType?: string;
  transmission?: string;
  year?: number;
  /** Sözlükle ve yukarıdakilerle açıklanamayan kelimeler (kayıtlı sıkı modda hiç yoktur). */
  extraWords: string[];
  /** Kullanıcıya gösterilen düzeltilmiş ad: "Chery Tiggo 7 Pro". */
  label: string;
  distance: number;
}

function commonWordPrefix(labels: string[]): string {
  const words = labels.map((label) => label.split(" "));
  const first = words[0];
  let length = 0;
  while (length < first.length && words.every((w) => w[length]?.toLocaleLowerCase("tr-TR") === first[length].toLocaleLowerCase("tr-TR"))) {
    length += 1;
  }
  return first.slice(0, length).join(" ");
}

/**
 * Aranan metni sözlüğe göre düzeltir. Kelimelerin bitişik dizisi (boşluksuz birleştirilmiş) sözlükle eşleştirilir; en uzun dizi
 * kazanır, kalan kelimeler yakıt/vites/yıl ise filtre olur. strict: açıklanamayan kelime kalırsa düzeltme yapılmaz (kullanıcının
 * yazdığı başka sözcük sessizce yutulmasın); gevşek modda kalan kelimeler yalnızca başlıkta aranacak ek kelimedir.
 */
export function correctSearch(query: string, candidates: SearchCandidate[], options: { strict: boolean }): SearchCorrection | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return null;
  for (let length = tokens.length; length >= 1; length--) {
    for (let start = 0; start + length <= tokens.length; start++) {
      const q = compactKey(tokens.slice(start, start + length).join(""));
      // Tek kelimelik parça kısa kalırsa ("ve", "ile") sözlükte rastgele bir şeye benzemesin.
      if (q.length < MIN_QUERY_LENGTH || (length < tokens.length && q.length < 4)) continue;
      const hit = bestMatches(q, candidates);
      if (!hit) continue;
      const rest = [...tokens.slice(0, start), ...tokens.slice(start + length)];
      const out: SearchCorrection = { matches: hit.matches, extraWords: [], label: "", distance: hit.distance };
      for (const word of rest) {
        const key = compactKey(word);
        if (FUEL_WORDS[key] && !out.fuelType) out.fuelType = FUEL_WORDS[key];
        else if (TRANSMISSION_WORDS[key] && !out.transmission) out.transmission = TRANSMISSION_WORDS[key];
        else if (/^(19|20)\d{2}$/.test(key) && out.year === undefined) out.year = Number(key);
        else out.extraWords.push(word);
      }
      if (options.strict && out.extraWords.length > 0) continue;
      const labels = hit.matches.map((m) => m.label);
      // Eşit uzaklıkta birkaç ad varsa ("Corolla" / "Corona") hepsi yazılır; çok sayıdaysa ortak başlangıç ("Chery Tiggo").
      let label = labels.length === 1 ? labels[0] : labels.length <= 3 ? labels.join(" / ") : commonWordPrefix(labels) || labels[0];
      const attributes = [out.fuelType, out.transmission, out.year ? String(out.year) : undefined].filter(Boolean);
      if (attributes.length > 0) label += ` · ${attributes.join(" · ")}`;
      out.label = label;
      return out;
    }
  }
  return null;
}
