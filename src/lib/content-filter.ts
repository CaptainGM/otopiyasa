/**
 * Kural tabanlı içerik filtresi (küfür, hakaret, dış bağlantı, kapora).
 *
 * NEDEN AYRI BİR KATMAN: ilan açıklamasını denetleyen tek şey Gemini idi ve
 * yanıt alınamayınca (API anahtarı yok, günlük kota bitti, zaman aşımı, 5xx)
 * ilan olduğu gibi ONAYLANIYORDU. Soru, cevap, yorum ve teklif mesajlarında ise
 * hiç denetim yoktu. Bu filtre yapay zekadan bağımsız, deterministik ve ücretsizdir;
 * yapay zeka ikinci katman olarak kalır.
 *
 * Yanlış pozitiflere karşı sözcük tabanlıdır ("sıkıntısız", "Amasya", "sıkışık"
 * geçmemeli): kısa kökler yalnızca tam sözcük olarak, uzun kökler önek olarak eşleşir.
 */

export type ContentCategory = "profanity" | "scam" | "link";

export interface ContentVerdict {
  ok: boolean;
  category?: ContentCategory;
  /** Kullanıcıya gösterilecek kısa, kibar açıklama. */
  reason?: string;
}

const OK: ContentVerdict = { ok: true };

/** Türkçe harfleri sadeleştirir, büyük/küçük harf ve görünmez karakterleri eler. */
export function foldForFilter(text: string): string {
  return (text || "")
    .normalize("NFKC")
    .replace(/[​-‍⁠﻿­]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[âä]/g, "a")
    .replace(/[îï]/g, "i")
    .replace(/û/g, "u");
}

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

/** "s1kt1r", "0rospu" gibi rakamla gizlenmiş sözcükleri çözer (yalnızca harf içeren sözcüklerde). */
function deLeet(token: string): string {
  if (!/\p{L}/u.test(token)) return token;
  if (!/[013457@$!]/.test(token)) return token;
  return token.replace(/[013457@$!]/g, (c) => LEET[c] || c);
}

/** Ardışık aynı harfleri teke indirir: "amkkkk" → "amk", "orospuuu" → "orospu", "yarrrak" → "yarak". */
function squash(token: string): string {
  return token.replace(/(\p{L})\1+/gu, "$1");
}

const normalizeWord = (word: string) => squash(foldForFilter(word));

// Yalnızca TAM SÖZCÜK olarak eşleşenler (kısa ve başka sözcüklerin içinde geçebilenler).
// "AMG" gibi meşru araç terimleri bilerek listede yok. Sözlükler, uzatılmış yazımlarla
// karşılaştırılabilmesi için squash() ile normalleştirilir.
const EXACT_TOKENS = new Set(
  [
    "amk", "aq", "amq", "oc", "pic", "piclik", "picler", "got", "gotu", "gotum", "gotunu", "gotune",
    "gotlek", "gotveren", "ibne", "ibnelik", "ibneler", "sikim", "sikimi", "sikime", "sikimde", "sikerim",
    "sikeyim", "siktir", "siktirgit", "siktirin", "siktim", "sikti", "sikik", "sikiklik", "sikismek", "sikis",
    "amcik", "amciklar", "yarrak", "yarragim", "yarrakli", "dalyarrak", "dalyarak", "salak", "aptal", "gerzek",
    "dangalak", "andaval", "angut", "pust", "gavat", "kahpe", "surtuk", "haysiyetsiz", "serefsiz",
    "gerizekali", "pezevenk", "orospu", "orospular", "fuck", "fucker", "fucking", "shit", "bitch", "asshole",
    "bastard", "motherfucker",
  ].map(normalizeWord)
);

// Önek olarak eşleşenler (uzun ve belirgin kökler; ek almış hâllerini de yakalar).
const PREFIX_STEMS = [
  "orospu", "pezevenk", "yarrak", "aminakoy", "amina", "amcik", "siktir", "sikeyim", "sikerim", "gotunu",
  "gotveren", "ibne", "kahpe", "dalyarak", "dalyarrak", "fuck", "motherfuck", "gerizekali", "serefsiz", "surtuk",
].map(normalizeWord);

// Harf harf ayrılarak ya da noktalama ile gizlenenler için "yalnızca harf" metninde aranan uzun kökler.
const COMPACT_STEMS = ["siktir", "orospu", "yarrak", "pezevenk", "aminakoy", "motherfuck", "gerizekali"].map(normalizeWord);

const TOKEN_SPLIT = /[^\p{L}\p{N}@$!]+/u;

const SCAM_PATTERNS: RegExp[] = [
  /\bkapora\b|\bkaparo\b|\bpesinat\b/,
  /\bon\s*odeme\b|\bonden\s*odeme\b/,
  /\biban\b|\btr\d{2}\s?\d{4}/,
  /\bwestern\s*union\b|\bpapara\b|\bmoneygram\b/,
  /\bhavale\s*(ile|yap)/,
];

const LINK_PATTERNS: RegExp[] = [
  /https?:\/\//,
  /\bwww\./,
  /\b[a-z0-9-]{2,}\.(com|net|org|info|biz|xyz|app|co|io|tr|shop|site|online)\b/,
  /\b(whatsapp|whatsap|watsap|telegram|instagram|insta|facebook|snapchat|viber|signal)\b/,
  /\bwp['’]?(dan|den|tan|ten)?\b/,
];

/** Metinde küfür/hakaret var mı? */
export function containsProfanity(text: string): boolean {
  const folded = foldForFilter(text);
  if (!folded.trim()) return false;

  const tokens = folded.split(TOKEN_SPLIT).filter(Boolean);
  // "a m k" gibi harf harf yazılanları birleştir: ardışık tek harfli sözcük dizileri tek sözcük sayılır.
  const candidates = [...tokens];
  let run = "";
  for (const t of [...tokens, ""]) {
    if (t.length === 1 && /\p{L}/u.test(t)) {
      run += t;
    } else {
      if (run.length >= 2) candidates.push(run);
      run = "";
    }
  }

  for (const raw of candidates) {
    const token = squash(deLeet(raw));
    if (EXACT_TOKENS.has(token)) return true;
    if (token.length >= 4 && PREFIX_STEMS.some((stem) => token.startsWith(stem))) return true;
  }

  // "s.i.k.t.i.r", "o r o s p u" gibi ayrıştırılmış yazımlar
  const compact = squash(deLeet(folded).replace(/[^a-z]/g, ""));
  return COMPACT_STEMS.some((stem) => compact.includes(stem));
}

const PROFANITY_REASON = "Metinde küfür veya hakaret içeren ifadeler var. Lütfen kibar bir dil kullanın.";

/** Herkese açık kısa metinler (soru, cevap, yorum, mesaj, işletme adı): yalnızca küfür/hakaret. */
export function checkPublicText(text: string): ContentVerdict {
  if (containsProfanity(text)) return { ok: false, category: "profanity", reason: PROFANITY_REASON };
  return OK;
}

/** İlan metni: küfür + kapora/ön ödeme + dış bağlantı / mesajlaşma uygulaması yönlendirmesi. */
export function checkListingText(fields: Array<string | undefined | null>): ContentVerdict {
  const text = fields.filter(Boolean).join("\n");
  if (containsProfanity(text)) return { ok: false, category: "profanity", reason: PROFANITY_REASON };

  const folded = foldForFilter(text);
  if (SCAM_PATTERNS.some((p) => p.test(folded))) {
    return {
      ok: false,
      category: "scam",
      reason: "Açıklamada kapora, ön ödeme veya IBAN gibi ifadeler olamaz. Ödemeler platform dışında, aracı görerek yapılmalıdır.",
    };
  }
  if (LINK_PATTERNS.some((p) => p.test(folded))) {
    return {
      ok: false,
      category: "link",
      reason: "Açıklamada web adresi veya mesajlaşma uygulaması yönlendirmesi olamaz. İletişim için telefon alanını kullanın.",
    };
  }
  return OK;
}
