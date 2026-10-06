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

/**
 * Yüzdeye Türkçe iyelik eki: "%81'i", "%40'ı", "%17'si", "%6'sı". Ek, sayının okunuşunun son sesine göre
 * değişir; sabit "'i" yazınca "%17'i" gibi hatalı metin çıkıyordu.
 */
export function trPercent(value: number): string {
  const n = Math.round(Math.abs(value));
  const ones = ["ı", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"]; // sıfır, bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz
  const tens = ["", "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"]; // on, yirmi, otuz, kırk, elli, altmış, yetmiş, seksen, doksan
  const suffix =
    n === 0 ? "ı" : n % 10 !== 0 ? ones[n % 10] : n % 100 !== 0 ? tens[(n / 10) % 10] : n % 1000 !== 0 ? "ü" : "i";
  return `%${Math.round(value)}'${suffix}`;
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** "3 saat önce", "2 gün önce" gibi kısa Türkçe göreli zaman. Mobildeki relativeTimeTr ile aynı kurallar. */
export function formatRelativeTr(value: string | Date | undefined | null, now: Date = new Date()): string {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.max(0, Math.floor((now.getTime() - time) / 60000));
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
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
