export function formatPrice(price: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Türkiye Saati (UTC+3, Europe/Istanbul) referans alınarak DD.MM.YYYY formatında tarih döndürür.
 * Sunucu nerede (Vercel UTC, Frankfurt UTC+1, vb.) olursa olsun her zaman Türkiye takvim gününü verir.
 */
export function getTurkeyDateStr(date: Date = new Date()): string {
  const trParts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const getP = (type: string) => trParts.find((p) => p.type === type)?.value || "00";
  return `${getP("day")}.${getP("month")}.${getP("year")}`;
}

/**
 * Türkiye gününe göre bir önceki günün (Dün) DD.MM.YYYY formatını döndürür.
 */
export function getTurkeyYesterdayStr(date: Date = new Date()): string {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getTurkeyDateStr(yesterday);
}


export function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const TURKISH_CASE_CLASSES: Record<string, string> = {
  i: "iıİI", ı: "iıİI", İ: "iıİI", I: "iıİI",
  ş: "şŞ", Ş: "şŞ",
  ğ: "ğĞ", Ğ: "ğĞ",
  ü: "üÜ", Ü: "üÜ",
  ö: "öÖ", Ö: "öÖ",
  ç: "çÇ", Ç: "çÇ",
};


export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}


export function turkishSearchRegex(input: string): string {
  return input
    .split("")
    .map((ch) =>
      TURKISH_CASE_CLASSES[ch] ? `[${TURKISH_CASE_CLASSES[ch]}]` : escapeRegExp(ch)
    )
    .join("");
}

/**
 * Otomotiv ilan başlıklarından marka/model ve genel ilan klişelerini temizleyip
 * araca özgü paket, gövde tipi, motor hacmi veya alt-model kodlarını (örn: "320i", "110", "comfortline", "joy", "amg")
 * dinamik olarak çıkaran %100 jenerik anahtar kelime fonksiyonu.
 */
export function extractVehicleTokens(title: string, brand?: string, model?: string): string[] {
  if (!title) return [];
  const stopWords = new Set([
    "sahibinden", "galeriden", "yetkili", "bayiden", "model", "hatasız", "hatasiz",
    "boyasız", "boyasiz", "degisensiz", "değişensiz", "tramersiz", "hasarsiz", "hasarsız",
    "acil", "satılık", "satilik", "ilk", "temiz", "bakımlı", "bakimli", "orijinal",
    "masrafsız", "masrafsiz", "fırsat", "firsat", "dolu", "full", "plus", "km", "bin",
    "manuel", "otomatik", "dizel", "benzin", "lpg", "elektrik", "hibrit", "araba", "araç",
  ]);

  const cleanBrand = (brand || "").toLocaleLowerCase("tr-TR").trim();
  const cleanModel = (model || "").toLocaleLowerCase("tr-TR").trim();

  const words = title
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9ğüşıöç\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w) && w !== cleanBrand && w !== cleanModel);

  return Array.from(new Set(words));
}

/**
 * İki araç başlığı arasındaki jenerik alt-model/paket benzerlik skorunu hesaplar.
 */
export function calculateTitleMatchScore(targetTokens: string[], candidateTitle: string): number {
  if (targetTokens.length === 0 || !candidateTitle) return 0;
  const cTitle = candidateTitle.toLocaleLowerCase("tr-TR");
  let matches = 0;
  for (const token of targetTokens) {
    const regex = new RegExp(`\\b${escapeRegExp(token)}\\b`, "i");
    if (regex.test(cTitle)) {
      matches += 1;
    }
  }
  return matches;
}
