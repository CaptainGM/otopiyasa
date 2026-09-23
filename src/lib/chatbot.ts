import { Car } from "@/models/Car";
import { formatPrice, turkishSearchRegex } from "@/lib/utils";
import { classifyIntent, isGeminiConfigured, GeminiIntent } from "@/lib/gemini";
import { cached, CACHE_TTL } from "@/lib/cache";


export interface ChatContext {
  carId?: string;
  brand?: string;
}

export interface ChatLink {
  href: string;
  label: string;
}


export interface ChatCard {
  href: string;
  title: string;
  price: number;
  imageUrl: string;
  subtitle?: string;
}


export interface ChatHistoryItem {
  role: "user" | "bot";
  text: string;
}

export interface ChatReply {
  reply: string;
  link?: ChatLink;
  card?: ChatCard;
  
  context?: ChatContext;
}

interface FaqEntry {
  keywords: string[];
  answer: string;
}

const FAQ: FaqEntry[] = [
  {
    keywords: ["favori", "kaydet"],
    answer:
      "Bir ilanı favorilere eklemek için araç detay sayfasındaki 'Favorilere Ekle' butonuna tıkla. Favorilerini üst menüdeki 'Favoriler' sekmesinden görebilirsin.",
  },
  {
    keywords: ["abone", "alarm", "bildirim"],
    answer:
      "Belirlediğin marka/model/fiyat kriterlerine uyan yeni bir ilan geldiğinde e-posta almak için 'Abonelikler' sayfasından abonelik oluşturabilirsin.",
  },
  {
    keywords: ["piyasa ortalama", "piyasa fiyatı", "ortalama ne"],
    answer:
      "Piyasa ortalaması, o aracın aynı marka/model/yıl segmentindeki tüm ilanların ortalama fiyatıdır — sayfadaki tüm ilanların genel ortalaması değildir.",
  },
  {
    keywords: ["tahmin", "yapay zeka", "makine öğren", "regresyon"],
    answer:
      "Fiyat Tahmini sayfasından marka/model/yıl/kilometre girerek, veritabanındaki ilanlar üzerinden eğitilmiş bir regresyon modeliyle tahmini piyasa fiyatı alabilirsin.",
  },
  {
    keywords: ["karşılaştır"],
    answer:
      "İki veya daha fazla aracı karşılaştırmak için üst menüdeki 'Karşılaştır' sayfasını kullanabilirsin.",
  },
  {
    keywords: ["harita", "konum", "nerede"],
    answer:
      "Haritada ilanları il bazında görebilirsin — üst menüdeki 'Harita' sekmesini aç.",
  },
  {
    keywords: ["veri kaynağı", "nereden geliyor", "scrape", "kaynak nedir"],
    answer:
      "İlanlar Arabam ve Otomerkezi gibi sitelerden derlenir; her ilan orijinal kaynağına bağlantı verir.",
  },
  {
    keywords: ["yorum", "puan ver", "değerlendirme"],
    answer:
      "Araç detay sayfasından yorum yazabilir, 1-5 arası puan verebilirsin. Yorumların altında olumlu/olumsuz duygu etiketi otomatik hesaplanır.",
  },
  {
    keywords: ["giriş", "kayıt ol", "üye ol", "hesap"],
    answer:
      "Sağ üstteki 'Giriş' veya 'Kayıt Ol' bağlantılarını kullanarak hesap oluşturabilirsin.",
  },
];

function normalize(message: string) {
  return message.toLocaleLowerCase("tr-TR").trim();
}


export function parseAmount(text: string): number | null {
  const milyon = text.match(/([\d.,]+)\s*milyon/);
  if (milyon) return Math.round(parseFloat(milyon[1].replace(",", ".")) * 1_000_000);
  const bin = text.match(/([\d.,]+)\s*bin/);
  if (bin) return Math.round(parseFloat(bin[1].replace(",", ".")) * 1_000);
  const plain = text.match(/(\d[\d.]{4,})/); 
  if (plain) return Number(plain[1].replace(/\./g, ""));
  return null;
}

export interface FilterCriteria {
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  fuelType?: string;
}

const FUEL_WORDS: Record<string, string> = {
  dizel: "Dizel",
  benzin: "Benzin",
  lpg: "LPG & Benzin",
  elektrik: "Elektrik",
  elektrikli: "Elektrik",
  hibrit: "Hibrit",
  hybrid: "Hibrit",
};


function amountAt(text: string): number | null {
  return parseAmount(text);
}


export function parseFilterCriteria(message: string): FilterCriteria {
  const t = message.toLocaleLowerCase("tr-TR");
  const out: FilterCriteria = {};


  for (const [word, label] of Object.entries(FUEL_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) {
      out.fuelType = label;
      break;
    }
  }


  const yearRange = t.match(/(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}/);
  const years = t.match(/\b(19|20)\d{2}\b/g)?.map(Number) || [];
  if (yearRange && years.length >= 2) {
    out.yearMin = Math.min(years[0], years[1]);
    out.yearMax = Math.max(years[0], years[1]);
  } else if (years.length) {
    const y = years[0];
    if (/(sonra|üst|üzer|büyük|yeni|geç)/.test(t)) out.yearMin = y;
    else if (/(önce|alt|aşağı|küçük|eski)/.test(t)) out.yearMax = y;
    else out.yearMin = y; 
  }


  const priceRange = t.match(
    /([\d.,]+\s*(?:milyon|bin))\s*(?:ile|[-–]|ila|arası|arasında)?\s*([\d.,]+\s*(?:milyon|bin))\s*(?:aras|ila)/
  );
  if (priceRange) {
    const a = amountAt(priceRange[1]);
    const b = amountAt(priceRange[2]);
    if (a && b) {
      out.priceMin = Math.min(a, b);
      out.priceMax = Math.max(a, b);
    }
  } else {
 
    const priceToken = t.match(/([\d.,]+\s*(?:milyon|bin))/);
    if (priceToken) {
      const amount = amountAt(priceToken[1]);
      if (amount) {
        if (/(alt|aşağı|max|en fazla|kadar|bütçe)/.test(t)) out.priceMax = amount;
        else if (/(üst|üzer|min|en az|fazla|yukar)/.test(t)) out.priceMin = amount;
        else out.priceMax = amount;  
      }
    }
  }

  return out;
}

interface FilterFields {
  brand?: string;
  model?: string;
  city?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  fuelType?: string;
}


function filterReply(f: FilterFields, replyText?: string): ChatReply | null {
  const params = new URLSearchParams();
  if (f.brand) params.set("brand", f.brand);
  if (f.model) params.set("model", f.model);
  if (f.city) params.set("city", f.city);
  if (Number.isFinite(f.yearMin)) params.set("yearMin", String(f.yearMin));
  if (Number.isFinite(f.yearMax)) params.set("yearMax", String(f.yearMax));
  if (Number.isFinite(f.priceMin)) params.set("priceMin", String(f.priceMin));
  if (Number.isFinite(f.priceMax)) params.set("priceMax", String(f.priceMax));
  if (f.fuelType) params.set("fuelType", f.fuelType);
  if ([...params.keys()].length === 0) return null;


  if (Number.isFinite(f.priceMax)) params.set("sort", "price_desc");

  const bits: string[] = [];
  if (f.brand) bits.push(f.brand);
  if (f.model) bits.push(f.model);
  if (f.city) bits.push(f.city);
  if (f.yearMin && f.yearMax) bits.push(`${f.yearMin}-${f.yearMax}`);
  else if (f.yearMin) bits.push(`${f.yearMin} sonrası`);
  else if (f.yearMax) bits.push(`${f.yearMax} öncesi`);
  if (f.priceMin && f.priceMax) bits.push(`${formatPrice(f.priceMin)}-${formatPrice(f.priceMax)}`);
  else if (f.priceMax) bits.push(`${formatPrice(f.priceMax)} bütçe`);
  else if (f.priceMin) bits.push(`${formatPrice(f.priceMin)} üstü`);
  if (f.fuelType) bits.push(f.fuelType);
  const summary = bits.join(", ");

  return {
    reply: replyText || `İşte kriterlerine uyan ilanlar${summary ? ` (${summary})` : ""}:`,
    link: { href: `/?${params.toString()}`, label: "Bu ilanları gör →" },
  };
}


async function detectBrand(message: string): Promise<string | undefined> {
  const brands = await cached(
    "chat:brands",
    CACHE_TTL.long,
    () => Car.distinct("brand") as Promise<string[]>
  );
  const m = message.toLocaleLowerCase("tr-TR");
  const sorted = [...brands].filter(Boolean).sort((a, b) => b.length - a.length);
  return sorted.find((b) => m.includes(b.toLocaleLowerCase("tr-TR")));
}


async function detectCity(message: string): Promise<string | undefined> {
  const cities = await cached(
    "chat:cities",
    CACHE_TTL.long,
    async () =>
      ((await Car.distinct("city")) as string[]).filter((c) => c && c !== "Türkiye")
  );
  const m = message.toLocaleLowerCase("tr-TR");
  const sorted = [...cities].sort((a, b) => b.length - a.length);
  return sorted.find((c) => {
    const needle = c.toLocaleLowerCase("tr-TR");
    const at = m.indexOf(needle);
    if (at < 0) return false;
   
    return at === 0 || !/\p{L}/u.test(m[at - 1]);
  });
}


function isFollowUp(message: string): boolean {
  return /\b(onun|bunun|şunun|onların|aynı|o model|o marka|peki|bunlar)\b/.test(
    message.toLocaleLowerCase("tr-TR")
  );
}


async function fastReply(message: string, context?: ChatContext): Promise<ChatReply | null> {
  const c = parseFilterCriteria(message);
  const hasCriteria = c.yearMin || c.yearMax || c.priceMin || c.priceMax || c.fuelType;
  if (hasCriteria) {
    const [detected, city] = await Promise.all([detectBrand(message), detectCity(message)]);
   
    const brand = detected || (isFollowUp(message) ? context?.brand : undefined);
    const reply = filterReply({ ...c, brand, city });
    if (reply) return reply;
  }
  
  return tryDataQuery(message, context, true);
}

interface CarLite {
  _id: { toString(): string };
  title: string;
  price: number;
  brand: string;
  imageUrl?: string;
}

function carCard(car: CarLite): ChatCard {
  return {
    href: `/cars/${car._id.toString()}`,
    title: car.title,
    price: car.price,
    imageUrl: car.imageUrl || "",
    subtitle: car.brand,
  };
}

function carContext(car: CarLite): ChatContext {
  return { carId: car._id.toString(), brand: car.brand };
}

const GREETING_WORDS = ["merhaba", "selam", "slm", "günaydın", "iyi günler", "hey", "naber"];
const THANKS_WORDS = ["teşekkür", "sağ ol", "sağol", "eyvallah", "tşk"];
const REDIRECT_WORDS = [
  "ilana git",
  "ilana yönlendir",
  "yönlendir",
  "link",
  "detay",
  "göster",
  "aç ",
  "götür",
  "bağlantı",
];


const LIST_WORDS = [
  "ilanlar",
  "ilanları",
  "ilanlarına",
  "araçlar",
  "araclar",
  "arabalar",
  "arabaların",
  "listesi",
  "hepsi",
];


const KEYWORD_STOP = new Set([
  "beni", "bana", "tum", "tüm", "hepsi", "goster", "göster", "yonlendir", "yönlendir",
  "yonlendirir", "yönlendirir", "misin", "mısın", "musun", "müsün", "lutfen", "lütfen",
  "ilan", "ilana", "ilanlar", "ilanları", "ilanlarina", "ilanlarına", "arac", "araç",
  "araclar", "araçlar", "araclari", "araçları", "araba", "arabalar", "arabalari",
  "arabaları", "arabalarin", "arabaların", "oldugu",
  "olduğu", "yer", "yere", "git", "gitmek", "listesi", "liste", "ve", "ile", "bir",
  "o", "su", "şu", "bu", "sayfa", "sayfasi", "sayfası", "sayfasina", "sayfasına",
  "ye", "ya", "de", "da", "link", "detay", "bağlantı", "baglanti", "ana", "sayfaya",
]);


const VERB_PREFIXES = ["yönlendir", "yonlendir", "göster", "goster", "götür", "gotur"];

export function extractSearchTerm(message: string): string {
  const tokens = message
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zçğıöşü0-9]/gi, ""))
    .filter((t) => {
      if (t.length === 0 || KEYWORD_STOP.has(t)) return false;
      
      if (/(misin|mısın|musun|müsün)$/.test(t)) return false;
      
      if (VERB_PREFIXES.some((p) => t.startsWith(p))) return false;
      return true;
    });
  if (tokens.length === 0) return "";
  const withDigit = tokens.find((t) => /\d/.test(t));
  return withDigit || tokens[tokens.length - 1];
}

async function findExtreme(brand: string, direction: 1 | -1): Promise<CarLite | null> {
  return Car.findOne({ brand: { $regex: turkishSearchRegex(brand), $options: "i" } })
    .sort({ price: direction })
    .select("title price brand imageUrl")
    .lean<CarLite | null>();
}

/**
 * Veri sorgusu niyetlerini dener; eşleşme yoksa null döner.
 * @param skipRedirect Hızlı yolda `true` — düşük güvenli "yönlendirme/liste"
 *   bloğu atlanır (sohbet sorularını yanlışlıkla aramaya çevirmesin; onlar
 *   Gemini'ye gitsin).
 */
async function tryDataQuery(
  message: string,
  context?: ChatContext,
  skipRedirect = false
): Promise<ChatReply | null> {

  if (/kaç\s+(ilan|araç|arac)/.test(message)) {
    const count = await Car.countDocuments();
    return { reply: `Şu anda veritabanında toplam ${count} ilan var.` };
  }

 
  const extreme = message.match(/en\s+(ucuz|pahalı|pahali)\s+([a-zçğıöşü0-9\s]+)/i);
  if (extreme) {
    const direction: 1 | -1 = extreme[1].startsWith("ucuz") ? 1 : -1;
    const tokens = extreme[2].trim().split(/\s+/).filter(Boolean);
    const brand = tokens[0];
    const car = await findExtreme(brand, direction);
    const label = direction === 1 ? "En ucuz" : "En pahalı";
    if (car) {
      return {
        reply: `${label} ${car.brand} ilanı: "${car.title}" – ${formatPrice(car.price)}.`,
        card: carCard(car),
        context: carContext(car),
      };
    }
    return { reply: `"${brand}" markasına ait bir ilan bulamadım.` };
  }

  
  const avgMatch = message.match(/^(.*?)\s+(ortalama fiyat|fiyat ortalama)/i);
  if (avgMatch) {
    const brand = avgMatch[1].trim().split(/\s+/).pop();
    if (brand) {
      const stats = await Car.aggregate([
        { $match: { brand: { $regex: turkishSearchRegex(brand), $options: "i" } } },
        { $group: { _id: null, avgPrice: { $avg: "$price" }, count: { $sum: 1 } } },
      ]);
      if (stats.length && stats[0].count > 0) {
        return {
          reply: `${brand} markasının ortalama ilan fiyatı ${formatPrice(
            Math.round(stats[0].avgPrice)
          )} (${stats[0].count} ilan).`,
        };
      }
      return { reply: `"${brand}" markasına ait ilan bulamadım.` };
    }
  }

  
  if (message.includes("altı") || message.includes("altında") || message.includes("altinda")) {
    const amount = parseAmount(message);
    const brandMatch = message.match(/([a-zçğıöşü]{2,})\s*(?:markası|marka)?/gi);
    if (amount && brandMatch) {

      const stop = new Set(["altı", "altında", "altinda", "bin", "milyon", "tl", "lira", "olan", "bir", "araç", "arac"]);
      const brand = message
        .replace(/[\d.,]+/g, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .find((w) => w.length >= 2 && !stop.has(w));
      if (brand) {
        const car = await Car.findOne({
          brand: { $regex: turkishSearchRegex(brand), $options: "i" },
          price: { $lte: amount },
        })
          .sort({ price: -1 })
          .select("title price brand imageUrl")
          .lean<CarLite | null>();
        if (car) {
          return {
            reply: `${formatPrice(amount)} altında bulduğum en iyi ${car.brand}: "${car.title}" – ${formatPrice(car.price)}.`,
            card: carCard(car),
            context: carContext(car),
          };
        }
        return {
          reply: `${formatPrice(amount)} altında "${brand}" ilanı bulamadım.`,
        };
      }
    }
  }

  
  if (skipRedirect) return null;
  const hasRedirect = REDIRECT_WORDS.some((w) => message.includes(w.trim()));
  const hasList = LIST_WORDS.some((w) => message.includes(w));
  if (hasRedirect || hasList) {
    
    const term = extractSearchTerm(message);
    if (term) {
      return {
        reply: `İşte "${term}" ile eşleşen ilanlar:`,
        link: { href: `/?q=${encodeURIComponent(term)}`, label: `"${term}" ilanlarını gör →` },
      };
    }
 
    if (hasRedirect) {
      if (context?.carId) {
        return {
          reply: "Tabii, işte o ilan:",
          link: { href: `/cars/${context.carId}`, label: "İlana git →" },
          context,
        };
      }
      return {
        reply:
          "Hangi ilanı açmamı istersin? 'en ucuz BMW' gibi bir arama yap ya da 'BMW 320i ilanları' de.",
      };
    }
  }

  return null;
}

function matchFaq(message: string): string | null {
  let best: { answer: string; score: number } | null = null;
  for (const entry of FAQ) {
    const score = entry.keywords.filter((keyword) => message.includes(keyword)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { answer: entry.answer, score };
    }
  }
  return best?.answer || null;
}

const FALLBACK_ANSWER =
  "Bunu tam anlayamadım 🤔 Şunları deneyebilirsin: 'en ucuz BMW', 'en pahalı Audi', 'kaç ilan var', 'Toyota ortalama fiyat', '500 bin altı Fiat' ya da favoriler / abonelik / fiyat tahmini / karşılaştırma hakkında sorular.";


let siteContextCache: { text: string; at: number } | null = null;
const SITE_CONTEXT_TTL = 10 * 60 * 1000;

async function buildSiteContext(): Promise<string> {
  if (siteContextCache && Date.now() - siteContextCache.at < SITE_CONTEXT_TTL) {
    return siteContextCache.text;
  }
  try {
    const [total, brands] = await Promise.all([
      Car.countDocuments(),
      Car.distinct("brand"),
    ]);
    const brandList = (brands as string[])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "tr"))
      .join(", ");
    const text = `Toplam ilan sayısı: ${total}. Mevcut markalar: ${brandList}.`;
    siteContextCache = { text, at: Date.now() };
    return text;
  } catch {
    return "Envanter bilgisi şu an alınamadı.";
  }
}


async function handleIntent(
  intent: GeminiIntent,
  context: ChatContext | undefined,
  userMessage: string
): Promise<ChatReply | null> {
  const term = (intent.term || "").trim();

  
  if (intent.action !== "filter") {
    const c = parseFilterCriteria(userMessage);
    const hasCriteria =
      c.yearMin || c.yearMax || c.priceMin || c.priceMax || c.fuelType;
    if (hasCriteria) {
      intent = { ...intent, action: "filter" };
    }
  }

  switch (intent.action) {
    case "search":
      if (!term) return { reply: intent.reply || FALLBACK_ANSWER };
      return {
        reply: intent.reply?.trim() || `İşte "${term}" ile eşleşen ilanlar:`,
        link: {
          href: `/?q=${encodeURIComponent(term)}`,
          label: `"${term}" ilanlarını gör →`,
        },
      };

    case "filter": {
      
      const parsed = parseFilterCriteria(userMessage);
      const gf = intent.filters || {};
      
      const yr = (v?: number) => (Number.isFinite(v) && v! >= 1950 && v! <= 2100 ? v : undefined);
      const pr = (v?: number) => (Number.isFinite(v) && v! >= 10_000 ? v : undefined);
      const merged = {
        brand: gf.brand,
        model: gf.model,
       
        city: await detectCity(userMessage),
        yearMin: parsed.yearMin ?? yr(gf.yearMin),
        yearMax: parsed.yearMax ?? yr(gf.yearMax),
        priceMin: parsed.priceMin ?? pr(gf.priceMin),
        priceMax: parsed.priceMax ?? pr(gf.priceMax),
        fuelType: parsed.fuelType ?? gf.fuelType,
      };
      const reply = filterReply(merged, intent.reply?.trim());
      if (reply) return reply;
      
      if (!term) return { reply: intent.reply?.trim() || FALLBACK_ANSWER };
      return {
        reply: intent.reply?.trim() || `İşte "${term}" ilanları:`,
        link: { href: `/?q=${encodeURIComponent(term)}`, label: `"${term}" ilanlarını gör →` },
      };
    }

    case "cheapest":
    case "priciest": {
      if (!term) return { reply: intent.reply || FALLBACK_ANSWER };
      const direction: 1 | -1 = intent.action === "cheapest" ? 1 : -1;
      const car = await findExtreme(term, direction);
      if (!car) return { reply: `"${term}" markasına ait bir ilan bulamadım.` };
      const label = direction === 1 ? "En ucuz" : "En pahalı";
      return {
        reply: `${label} ${car.brand} ilanı: "${car.title}" – ${formatPrice(car.price)}.`,
        card: carCard(car),
        context: carContext(car),
      };
    }

    case "count": {
      const count = await Car.countDocuments();
      return { reply: `Şu anda veritabanında toplam ${count} ilan var.` };
    }

    case "average": {
      if (!term) return { reply: intent.reply || FALLBACK_ANSWER };
      const stats = await Car.aggregate([
        { $match: { brand: { $regex: turkishSearchRegex(term), $options: "i" } } },
        { $group: { _id: null, avgPrice: { $avg: "$price" }, count: { $sum: 1 } } },
      ]);
      if (stats.length && stats[0].count > 0) {
        return {
          reply: `${term} markasının ortalama ilan fiyatı ${formatPrice(
            Math.round(stats[0].avgPrice)
          )} (${stats[0].count} ilan).`,
        };
      }
      return { reply: `"${term}" markasına ait ilan bulamadım.` };
    }

    case "open": {
      if (context?.carId) {
        const car = await Car.findById(context.carId)
          .select("title price brand imageUrl")
          .lean<CarLite | null>()
          .catch(() => null);
        if (car) {
          return {
            reply: intent.reply?.trim() || "Tabii, işte o ilan:",
            card: carCard({ ...car, _id: context.carId }),
            context,
          };
        }
        return {
          reply: intent.reply?.trim() || "Tabii, işte o ilan:",
          link: { href: `/cars/${context.carId}`, label: "İlana git →" },
          context,
        };
      }
      return {
        reply:
          "Hangi ilanı açmamı istersin? Önce 'en ucuz BMW' gibi bir arama yap ya da 'BMW 320i ilanları' de.",
      };
    }

    case "answer":
    default:
      return { reply: intent.reply?.trim() || FALLBACK_ANSWER };
  }
}

export async function answerQuery(
  rawMessage: string,
  context?: ChatContext,
  history?: ChatHistoryItem[]
): Promise<ChatReply> {
  const message = normalize(rawMessage);
  if (!message) return { reply: FALLBACK_ANSWER };


  if (message.length <= 20 && GREETING_WORDS.some((w) => message.includes(w))) {
    return {
      reply:
        "Merhaba! 👋 Araç ararken yardımcı olabilirim. '1 milyon altı 2015 sonrası', 'en ucuz BMW' ya da 'dizel SUV' gibi sorular sorabilirsin.",
    };
  }
  if (THANKS_WORDS.some((w) => message.includes(w))) {
    return { reply: "Rica ederim! 🙂 Başka bir konuda yardımcı olayım mı?" };
  }

 
  const fast = await fastReply(message, context);
  if (fast) return fast;

  
  if (isGeminiConfigured()) {
    try {
      const siteContext = await buildSiteContext();
      const intent = await classifyIntent(rawMessage, siteContext, context?.brand, history);
      if (intent) {
        const handled = await handleIntent(intent, context, rawMessage);
        if (handled) return handled;
      }
    } catch {
     
    }
  }

  
  const faqAnswer = matchFaq(message);
  if (faqAnswer) return { reply: faqAnswer };

  const redirectAnswer = await tryDataQuery(message, context);
  if (redirectAnswer) return redirectAnswer;

  return { reply: FALLBACK_ANSWER };
}
