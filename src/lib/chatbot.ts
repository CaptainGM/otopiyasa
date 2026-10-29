import { Car } from "@/models/Car";
import { formatPrice, turkishSearchRegex } from "@/lib/utils";
import { classifyIntent, isGeminiConfigured, GeminiIntent } from "@/lib/gemini";
import { cached, CACHE_TTL } from "@/lib/cache";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { ABSOLUTE_PRICE_FLOOR } from "@/lib/listing-validation";
import { topicLinkFor } from "@/lib/chat-topics";
import { modelFamilyRegex } from "@/lib/model-family";
import { Types } from "mongoose";
import { evaluateCarEquipment, EquipmentCategory } from "@/lib/catalog/car-equipment";
import type { TechnicalSpecs } from "@/types";

/**
 * Asistanın gösterebileceği ilanlar: yalnızca herkese açık (aktif, onaylı) ve makul fiyatlı olanlar.
 * Eskiden hiçbir sorguda görünürlük filtresi yoktu: "en ucuz BMW" arşive alınmış, satılmış ya da
 * reddedilmiş bir ilanı gösterebiliyordu ("kaç ilan var" da arşivdekileri sayıyordu).
 */
const VISIBLE = { ...PUBLIC_LISTING_FILTER, price: { $gte: ABSOLUTE_PRICE_FLOOR } };


export interface ChatContext {
  carId?: string;
  brand?: string;
  compareIds?: string[];
  pageUrl?: string;
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
  /** Arama yanıtlarında kriterlere uyan ilanlardan öne çıkanlar (bkz. lib/chat-picks.ts). */
  cards?: ChatCard[];
  
  context?: ChatContext;
}


export interface CompareCarDetail {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  km: number;
  fuelType?: string;
  transmission?: string;
  horsepower?: number;
  specs?: TechnicalSpecs;
  equipment: EquipmentCategory[];
}

export async function getCompareDetailsForAssistant(ids: string[]): Promise<CompareCarDetail[]> {
  try {
    const validIds = ids
      .map((id) => id.trim())
      .filter((id) => Types.ObjectId.isValid(id))
      .slice(0, 4);
    if (validIds.length === 0) return [];

    const objectIds = validIds.map((id) => new Types.ObjectId(id));
    const rawCars = (await Car.find({ _id: { $in: objectIds } }).lean()) as any[];

    const carMap = new Map<string, any>();
    for (const c of rawCars) {
      if (c && c._id) {
        carMap.set(c._id.toString(), c);
      }
    }

    const result: CompareCarDetail[] = [];
    for (const id of validIds) {
      const c = carMap.get(id);
      if (!c) continue;

      const equipment = evaluateCarEquipment({
        brand: c.brand,
        model: c.model,
        year: c.year,
        vehicleClass: c.vehicleClass,
        title: c.title,
        description: c.description,
        features: c.features,
      });

      result.push({
        id: c._id.toString(),
        title: c.title || `${c.brand} ${c.model}`,
        brand: c.brand || "",
        model: c.model || "",
        year: c.year || 2020,
        price: c.price || 0,
        km: c.km || 0,
        fuelType: c.features?.fuelType || c.fuelType,
        transmission: c.features?.transmission || c.transmission,
        horsepower: c.features?.horsepower || c.horsepower,
        equipment,
      });
    }

    return result;
  } catch (error) {
    console.error("getCompareDetailsForAssistant error:", error);
    return [];
  }
}

export function buildCompareSummaryText(cars: CompareCarDetail[]): string {
  return cars
    .map((c, i) => {
      const safetyYes = c.equipment
        .find((cat) => cat.id === "safety")
        ?.items.filter((it) => it.present)
        .map((it) => it.name)
        .join(", ");
      const comfortYes = c.equipment
        .find((cat) => cat.id === "comfort")
        ?.items.filter((it) => it.present)
        .map((it) => it.name)
        .join(", ");
      const extYes = c.equipment
        .find((cat) => cat.id === "exterior")
        ?.items.filter((it) => it.present)
        .map((it) => it.name)
        .join(", ");
      const mulYes = c.equipment
        .find((cat) => cat.id === "multimedia")
        ?.items.filter((it) => it.present)
        .map((it) => it.name)
        .join(", ");

      return [
        `Araç ${i + 1}: ${c.year} ${c.brand} ${c.model} (${c.title})`,
        `  Fiyat: ${formatPrice(c.price)} | KM: ${c.km.toLocaleString("tr-TR")} km`,
        `  Motor/Güç: ${c.horsepower ? `${c.horsepower} HP` : ""} ${c.fuelType || ""} ${c.transmission || ""}`,
        c.specs?.specSource === "web"
          ? `  Teknik: 0-100: ${c.specs.acceleration ?? "-"}s | Hız: ${c.specs.topSpeed ?? "-"} km/s | Tork: ${c.specs.torque ?? "-"} Nm | Bagaj: ${c.specs.trunkCapacity ?? "-"} L`
          : `  Teknik: veri yok`,
        `  Donanımlar (ilan metni ve paket standardı):`,
        safetyYes ? `    Güvenlik: ${safetyYes}` : "",
        comfortYes ? `    Konfor: ${comfortYes}` : "",
        extYes ? `    Dış: ${extYes}` : "",
        mulYes ? `    Teknoloji: ${mulYes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function isCompareRelatedQuery(
  message: string,
  cars: CompareCarDetail[],
  context?: ChatContext
): boolean {
  const norm = message.toLowerCase();

  const compareTerms = [
    "karşılaştır",
    "karsilastir",
    "kıyas",
    "kiyas",
    "özellik",
    "ozellik",
    "donanım",
    "donanim",
    "doğru mu",
    "dogru mu",
    "görüyor musun",
    "görüyormusun",
    "goruyor musun",
    "goruyormusun",
    "görüyor",
    "hangisi",
    "hangisini",
    "önerirsin",
    "onerirsin",
    "tavsiye",
    "mantıklı",
    "mantikli",
    "fark",
    "farkı",
    "farklar",
    "bu araç",
    "bu 3",
    "bu üç",
    "bu 2",
    "bu iki",
    "üç araç",
    "iki araç",
    "ekrandaki",
    "şu anki",
    "su anki",
  ];

  if (compareTerms.some((term) => norm.includes(term))) {
    return true;
  }

  for (const car of cars) {
    if (car.brand && car.brand.length > 2 && norm.includes(car.brand.toLowerCase())) return true;
    if (car.model && car.model.length > 2 && norm.includes(car.model.toLowerCase())) return true;
  }

  if (context?.pageUrl?.startsWith("/compare")) {
    return true;
  }

  return false;
}

export function generateDeterministicCompareAnswer(rawMessage: string, cars: CompareCarDetail[]): ChatReply {
  const norm = rawMessage.toLowerCase();
  const isAccuracyQuestion =
    norm.includes("doğru") ||
    norm.includes("dogru") ||
    norm.includes("özellik") ||
    norm.includes("ozellik") ||
    norm.includes("donanım") ||
    norm.includes("donanim") ||
    norm.includes("gör") ||
    norm.includes("gor");

  if (isAccuracyQuestion) {
    const list = cars
      .map((c) => {
        const topFeatures = c.equipment
          .flatMap((cat) => cat.items)
          .filter((it) => it.present)
          .slice(0, 5)
          .map((it) => it.name)
          .join(", ");
        return `• **${c.year} ${c.brand} ${c.model}** (${formatPrice(c.price)} - ${c.horsepower ? `${c.horsepower} HP` : ""}): ${topFeatures}`;
      })
      .join("\n");

    return {
      reply:
        `Şu an ekranındaki ${cars.length} aracı görüyorum:\n` +
        cars.map((c, i) => `${i + 1}. **${c.year} ${c.brand} ${c.model}** (${formatPrice(c.price)})`).join("\n") +
        `\n\nKarşılaştırma matrisindeki donanımlar iki kaynaktan çıkarılır; katalogda olmayan teknik veriler ise gösterilmez:\n\n` +
        `1. **Paket & Fabrika Standardı:** Model yılı ve donanım paketine ait standart donanımlar işaretlenir (örneğin Porsche Macan Turbo ve Mercedes Heritage Edition standart donanımları, Ford GLX standartları vb.).\n` +
        `2. **İlan Açıklaması:** Satıcının ilan açıklamasındaki donanımlar kelime analiziyle taranır; "hasar kaydı yoktur" gibi ifadeler donanım sanılmaz. İlanda hiç geçmeyen donanım "Belirtilmemiş" sayılır, yok sayılmaz.\n\n` +
        `**Araçların Öne Çıkan Donanımları:**\n${list}\n\n` +
        `Bu araçların performansı, yakıt tüketimi veya fiyat/fayda dengesi hakkında merak ettiğin başka bir detay var mı?`,
    };
  }

  const cheapest = [...cars].sort((a, b) => a.price - b.price)[0];
  const mostPowerful = [...cars].sort((a, b) => (b.horsepower || 0) - (a.horsepower || 0))[0];

  return {
    reply:
      `Şu an karşılaştırdığın ${cars.length} aracın özet kıyaslaması:\n\n` +
      cars
        .map(
          (c) =>
            `• **${c.year} ${c.brand} ${c.model}**: ${formatPrice(c.price)} | ${c.km.toLocaleString("tr-TR")} km | ${c.horsepower || "?"} HP (${c.fuelType || ""})`
        )
        .join("\n") +
      `\n\n💡 **Hızlı Değerlendirme:**\n` +
      `- En bütçe dostu seçenek: **${cheapest.year} ${cheapest.brand} ${cheapest.model}** (${formatPrice(cheapest.price)})\n` +
      (mostPowerful.horsepower
        ? `- En yüksek performans: **${mostPowerful.year} ${mostPowerful.brand} ${mostPowerful.model}** (${mostPowerful.horsepower} HP${mostPowerful.specs?.specSource === "web" && mostPowerful.specs.acceleration ? `, 0-100: ${mostPowerful.specs.acceleration} sn` : ""})\n`
        : "") +
      `\nKullanım amacına ve bütçene göre hangi aracı daha yakından incelemek istersin?`,
  };
}

interface FaqEntry {
  keywords: string[];
  answer: string;
}

const FAQ: FaqEntry[] = [
  {
    keywords: ["favori", "kaydet"],
    answer:
      "Bir ilanı favorilere eklemek için ilan sayfasındaki 'Favorilere ekle' butonuna tıkla ve hangi listeye koyacağını seç (varsayılan liste 'Favori Listem'; sedan, SUV gibi kendi listelerini de açabilirsin). Her ilana not ve fiyat bildirimi ekleyebilir, ilanı başka listeye taşıyabilirsin. Favorilerini üst menüdeki 'Favoriler' sekmesinden görebilirsin.",
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
    keywords: ["fiyat tahmini", "tahmini nasıl", "tahmin nasıl", "fiyat tahmini nasıl"],
    answer:
      "Fiyat tahmini, ilanın model yılı, kilometresi, hasar durumu ve motor, yakıt, vites, beygir bilgileriyle aynı model ailesinin yayındaki ilanlarından hesaplanır. Aynı donanımdaki ilanlar öncelenir, yeterli değilse model geneli kullanılır. Arşive alınmış ilanlar tarihe göre azalan ağırlıkla katılır ve yazım hatası gibi görünen fiyatlar hesaba girmez.",
  },
  {
    keywords: ["tahmin", "yapay zeka", "makine öğren", "regresyon"],
    answer:
      "Fiyat Tahmini sayfasından marka/model/yıl/kilometre girerek, veritabanındaki ilanlar üzerinden eğitilmiş bir regresyon modeliyle tahmini piyasa fiyatı alabilirsin.",
  },
  {
    keywords: ["karşılaştır"],
    answer:
      "İki veya daha fazla aracı karşılaştırmak için ilan kartındaki ya da ilan sayfasındaki 'Karşılaştır' düğmesine bas (en fazla 4 araç), sonra 'Karşılaştır' sayfasını aç.",
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
  transmission?: string;
}

/** "otomatik", "düz vites", "yarı otomatik" — kayıtlardaki vites yazımına çevrilir. */
function parseTransmission(t: string): string | undefined {
  if (/yar[ıi][\s-]*otomatik/.test(t)) return "Yarı Otomatik";
  if (/\b(otomatik|automatic|dsg|cvt)\b/.test(t)) return "Otomatik";
  if (/\b(manuel|manual)\b|düz\s*vites/.test(t)) return "Manuel";
  return undefined;
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
  const transmission = parseTransmission(t);
  if (transmission) out.transmission = transmission;


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
  transmission?: string;
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
  if (f.transmission) params.set("transmission", f.transmission);
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
  if (f.transmission) bits.push(f.transmission.toLocaleLowerCase("tr-TR") + " vites");
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
    () => Car.distinct("brand", PUBLIC_LISTING_FILTER) as Promise<string[]>
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
      ((await Car.distinct("city", PUBLIC_LISTING_FILTER)) as string[]).filter((c) => c && c !== "Türkiye")
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
  // Fiyat sorusu ("Renault Clio 2020 fiyatı ne kadar") yıl içerse de arama sayılmaz; önce piyasa medyanı denenir.
  const price = await priceQueryReply(message);
  if (price) return price;
  const c = parseFilterCriteria(message);
  const hasCriteria = c.yearMin || c.yearMax || c.priceMin || c.priceMax || c.fuelType || c.transmission;
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

/** Birden çok kelimeli marka adları ("Mercedes-Benz", "Land Rover"...). Bunlar dışında ilk kelime marka, kalanı model sayılır. */
const MULTI_WORD_BRANDS = ["mercedes-benz", "mercedes benz", "land rover", "alfa romeo", "aston martin", "rolls-royce", "rolls royce", "ds automobiles"];

/** "BMW 5 Serisi" → { brand: "BMW", model: "5 Serisi" }; tek kelimede model yoktur. */
export function splitBrandModel(term: string): { brand: string; model?: string } {
  const clean = term.trim();
  const lower = clean.toLocaleLowerCase("tr-TR");
  const multi = MULTI_WORD_BRANDS.find((b) => lower.startsWith(b));
  if (multi) {
    const model = clean.slice(multi.length).trim();
    return { brand: clean.slice(0, multi.length), model: model || undefined };
  }
  const [brand, ...rest] = clean.split(/\s+/);
  return { brand, model: rest.length ? rest.join(" ") : undefined };
}

/** Marka (ve varsa model ailesi) filtresi. Model adı kaynakta farklı yazılmış olabileceği için aile regex'i kullanılır. */
export function brandModelFilter(term: string): Record<string, unknown> {
  const { brand, model } = splitBrandModel(term);
  return {
    brand: { $regex: turkishSearchRegex(brand), $options: "i" },
    ...(model ? { model: modelFamilyRegex(model, brand) } : {}),
  };
}

/** Genel araç sözcükleri ("araç", "araba", "hangisi") marka ya da model sayılmaz; kalan terim aranır. */
const GENERIC_CAR_WORDS = new Set(["arac", "araç", "araclar", "araçlar", "araba", "arabalar", "hangisi", "hangi", "nedir", "ilan", "ilanı", "ilani", "olan", "var", "bir", "mi", "mı", "bu", "şu", "o", "bunun", "şunun", "onun", "ilanın", "aracın", "arabanın", "ne", "nasıl", "kadar"]);

export function cleanCarTerm(raw: string): string {
  return raw
    .split(/\s+/)
    .filter((word) => word && !GENERIC_CAR_WORDS.has(word.toLocaleLowerCase("tr-TR")))
    .join(" ");
}

/** Araç tipi kelimeleri ("motosiklet", "karavan"...) marka değil, ilan tipidir. */
const VEHICLE_CLASS_WORDS: Array<[RegExp, string]> = [
  [/^(motosiklet|motorsiklet|scooter)$/i, "motosiklet"],
  [/^(karavan|motokaravan)$/i, "karavan"],
  [/^(ticari|kamyon|kamyonet|otobüs|otobus|minibüs|minibus)$/i, "ticari"],
  [/^(suv|arazi|pickup|pick-up)$/i, "suv-pickup"],
  [/^(minivan|panelvan)$/i, "minivan-panelvan"],
  [/^(otomobil|sedan)$/i, "otomobil"],
];

function vehicleClassOf(term: string): string | null {
  const hit = VEHICLE_CLASS_WORDS.find(([pattern]) => pattern.test(term.trim()));
  return hit ? hit[1] : null;
}

/** Terimin kapsamı: araç tipi, marka (ve model) ya da yalnızca model adı ("Doblo" gibi markasız aramalar). Eşleşme yoksa null. */
async function scopeFilterFor(term: string): Promise<Record<string, unknown> | null> {
  const cls = vehicleClassOf(term);
  if (cls) return { vehicleClass: cls === "otomobil" ? { $in: ["otomobil", null] } : cls };
  const byBrand = brandModelFilter(term);
  if (await Car.exists({ ...VISIBLE, ...byBrand })) return byBrand;
  const byModel = { model: modelFamilyRegex(term) };
  if (await Car.exists({ ...VISIBLE, ...byModel })) return byModel;
  return null;
}

/** En ucuz/en pahalı ilan. Terim boşsa (genel soru) tüm yayındaki ilanlar arasında aranır; bayraklı fiyatlar VISIBLE ile dışarıda kalır. */
async function findExtreme(term: string, direction: 1 | -1): Promise<CarLite | null> {
  const scope = term ? (await scopeFilterFor(term)) ?? brandModelFilter(term) : {};
  return Car.findOne({ ...VISIBLE, ...scope })
    .sort({ price: direction })
    .select("title price brand imageUrl")
    .lean<CarLite | null>();
}

const PRICE_BLOCK_WORDS = new Set([
  "en", "ortalama", "altı", "alti", "altında", "altinda", "altındaki", "üstü", "ustu", "üstünde", "ustunde",
  "üzeri", "uzeri", "üzerinde", "uzerinde", "sonrası", "sonrasi", "öncesi", "oncesi", "arası", "arasi",
  "arasında", "arasinda", "tahmin", "tahmini", "hesap", "hesaplama", "nasıl", "nasil", "dizel", "benzin",
  "lpg", "hibrit", "elektrik", "elektrikli", "otomatik", "manuel", "vites",
]);

/**
 * Düz fiyat sorusu mu? Yalnızca model/marka ve (varsa) tek bir yıl içerir. Sıralama ("en ucuz"), ortalama, aralık,
 * yakıt, vites, yön ("2020 sonrası") ya da tahmin/nasıl soruları false döner; bunlar liste ve sohbet yoluna kalır.
 */
export function isPlainPriceQuestion(message: string): boolean {
  const text = message.toLocaleLowerCase("tr-TR");
  if (/kaç\s+(ilan|araç|arac)/.test(text) || /\d\s*(milyon|bin)/.test(text)) return false;
  const words = text.split(/\s+/).map((w) => w.replace(/[^a-zçğıöşü0-9]/g, ""));
  if (words.some((w) => PRICE_BLOCK_WORDS.has(w))) return false;
  const years = text.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  if (years.length > 1) return false;
  const criteria = parseFilterCriteria(text);
  if (criteria.priceMin || criteria.priceMax || criteria.fuelType || criteria.transmission || criteria.yearMax) return false;
  if (years.length === 1 && /(sonra|üst|üzer|büyük|yeni|geç)/.test(text)) return false;
  return true;
}

/** "Renault Clio 2020 fiyatı ne kadar", "Togg T10X fiyatı": aranan modelin piyasa medyanı. */
async function priceQueryReply(message: string): Promise<ChatReply | null> {
  const priceAsk = message.match(/^(.*?)\s+(fiyat(?:ı|i)?|ne kadar|kaç para|kac para)/i);
  if (!priceAsk || !isPlainPriceQuestion(message)) return null;
  const yearMatch = message.match(/\b((?:19|20)\d{2})\b/);
  let year = yearMatch ? Number(yearMatch[1]) : null;
  let term = cleanCarTerm(priceAsk[1].replace(/\b(?:19|20)\d{2}\b/g, " "));
  let scope = term ? await scopeFilterFor(term) : null;
  // "Peugeot 2008": sayı model adıysa yıl sayılmaz. Yalnızca marka + model birlikte eşleşirse kabul edilir; model adıyla eşleşme ("clio 2020") yılı düşürür.
  if (term && year && !term.includes(" ")) {
    const asModel = `${term} ${year}`;
    const modelScope = await scopeFilterFor(asModel);
    if (modelScope && "brand" in modelScope && "model" in modelScope) {
      term = asModel;
      scope = modelScope;
      year = null;
    }
  }
  if (!term || !scope) return null;
  const docs = await Car.find({ ...VISIBLE, ...scope, ...(year ? { year: { $gte: year - 1, $lte: year + 1 } } : {}) })
    .select("price")
    .limit(3000)
    .lean<{ price: number }[]>();
  if (docs.length < 3) return { reply: `"${term}" için yeterli ilan bulamadım.` };
  const prices = docs.map((d) => d.price).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const med = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  const label = year ? `${term} ${year} (±1 yıl)` : term;
  return {
    reply: `${label} için piyasa medyanı ${formatPrice(Math.round(med))} (${prices.length} ilan, ${formatPrice(prices[0])} – ${formatPrice(prices[prices.length - 1])}). Km, hasar ve donanıma göre ayrıntı için ilan sayfasındaki fiyat skalasına bak.`,
  };
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

  const countAsk = message.match(/^(.*?)\s*kaç\s+(?:ilan|araç|arac)/i);
  if (countAsk && cleanCarTerm(countAsk[1])) {
    const term = cleanCarTerm(countAsk[1]);
    const scope = await scopeFilterFor(term);
    if (!scope) return { reply: `"${term}" için aktif ilan bulamadım.` };
    const count = await Car.countDocuments({ ...VISIBLE, ...scope });
    return { reply: `${term} için ${count} aktif ilan var.` };
  }

  if (/kaç\s+(ilan|araç|arac)/.test(message)) {
    const count = await Car.countDocuments(PUBLIC_LISTING_FILTER);
    return { reply: `Şu anda veritabanında toplam ${count} ilan var.` };
  }

 
  const extreme = message.match(/en\s+(ucuz|pahalı|pahali)\s+([a-zçğıöşü0-9\s]+)/i);
  if (extreme) {
    const direction: 1 | -1 = extreme[1].startsWith("ucuz") ? 1 : -1;
    const term = cleanCarTerm(extreme[2]);
    const car = await findExtreme(term, direction);
    const label = direction === 1 ? "En ucuz" : "En pahalı";
    if (car) {
      return {
        reply: `${label} ${car.brand} ilanı: "${car.title}" – ${formatPrice(car.price)}.`,
        card: carCard(car),
        context: carContext(car),
      };
    }
    return { reply: term ? `"${term}" için bir ilan bulamadım.` : "Yayında ilan bulamadım." };
  }

  
  const avgMatch = message.match(/^(.*?)\s+(ortalama fiyat|fiyat ortalama)/i);
  if (avgMatch) {
    const brand = cleanCarTerm(avgMatch[1]);
    const scope = brand ? await scopeFilterFor(brand) : null;
    if (brand && scope) {
      const stats = await Car.aggregate([
        { $match: { ...VISIBLE, ...scope } },
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
          ...VISIBLE,
          ...brandModelFilter(brand),
          price: { $gte: ABSOLUTE_PRICE_FLOOR, $lte: amount },
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

function matchFaq(message: string, hasCompareContext: boolean = false): string | null {
  let best: { answer: string; score: number } | null = null;
  for (const entry of FAQ) {
    if (hasCompareContext && entry.keywords.includes("karşılaştır")) {
      continue;
    }
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
      Car.countDocuments(PUBLIC_LISTING_FILTER),
      Car.distinct("brand", PUBLIC_LISTING_FILTER),
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
      c.yearMin || c.yearMax || c.priceMin || c.priceMax || c.fuelType || c.transmission;
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
        transmission: parsed.transmission,
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
      const cleaned = cleanCarTerm(term);
      const car = await findExtreme(cleaned, direction);
      if (!car) return { reply: `"${cleaned || term}" için bir ilan bulamadım.` };
      const label = direction === 1 ? "En ucuz" : "En pahalı";
      return {
        reply: `${label} ${car.brand} ilanı: "${car.title}" – ${formatPrice(car.price)}.`,
        card: carCard(car),
        context: carContext(car),
      };
    }

    case "count": {
      const count = await Car.countDocuments(PUBLIC_LISTING_FILTER);
      return { reply: `Şu anda veritabanında toplam ${count} ilan var.` };
    }

    case "average": {
      if (!term) return { reply: intent.reply || FALLBACK_ANSWER };
      const stats = await Car.aggregate([
        { $match: { ...VISIBLE, ...brandModelFilter(term) } },
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
        // context.carId istemciden geliyor; yalnızca herkese açık ilan gösterilir.
        const car = await Car.findOne({ _id: context.carId, ...PUBLIC_LISTING_FILTER })
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
  const reply = await answerQueryInner(rawMessage, context, history);
  // Site özelliği anlatan düz metin yanıtlara tek dokunuşla ilgili sayfaya götüren düğme eklenir (nasıl ilan veririm → İlan ver).
  if (!reply.link && !reply.card && !reply.cards) {
    const topic = topicLinkFor(rawMessage);
    if (topic) return { ...reply, link: topic };
  }
  // Arama bağlantısı binlerce ilan açabiliyor; yanına en mantıklı birkaç öneri eklenir.
  if (reply.link?.href.startsWith("/?") && !reply.card && !reply.cards) {
    try {
      const { pickTopCars } = await import("@/lib/chat-picks");
      const { cards, total } = await pickTopCars(reply.link.href);
      if (cards.length > 0) {
        return {
          ...reply,
          reply: `${reply.reply.replace(/:s*$/, "")} — ${total.toLocaleString("tr-TR")} ilan var, öne çıkan ${cards.length} tanesi:`,
          cards,
          link: { ...reply.link, label: `Tümünü gör (${total.toLocaleString("tr-TR")}) →` },
        };
      }
      if (total === 0) return { reply: "Bu kriterlere uyan aktif ilan şu an yok. Bütçeyi ya da yılı biraz esnetmeyi deneyebilirsin." };
    } catch {
      // öneri hesaplanamazsa yalnızca bağlantı döner
    }
  }
  return reply;
}

async function answerQueryInner(
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

 
  // Aktif karşılaştırma bağlamı varsa (kullanıcı /compare sayfasında veya ekranda karşılaştırılan araçlar varken soru soruyorsa)
  let compareContextText: string | undefined;
  const hasCompareIds = Boolean(context?.compareIds && context.compareIds.length > 0);
  if (hasCompareIds && context?.compareIds) {
    const compareCars = await getCompareDetailsForAssistant(context.compareIds);
    if (compareCars.length > 0) {
      compareContextText = buildCompareSummaryText(compareCars);

      if (isCompareRelatedQuery(message, compareCars, context)) {
        if (isGeminiConfigured()) {
          try {
            const siteContext = await buildSiteContext();
            const intent = await classifyIntent(
              rawMessage,
              siteContext,
              context?.brand,
              history,
              compareContextText
            );
            if (intent && intent.action === "answer" && intent.reply) {
              return { reply: intent.reply };
            }
          } catch {
            // Gemini kota veya hata durumunda deterministik uzmana düşer
          }
        }
        return generateDeterministicCompareAnswer(rawMessage, compareCars);
      }
    }
  }

  const fast = await fastReply(message, context);
  if (fast) return fast;

  
  if (isGeminiConfigured()) {
    try {
      const siteContext = await buildSiteContext();
      const intent = await classifyIntent(rawMessage, siteContext, context?.brand, history, compareContextText);
      if (intent) {
        const handled = await handleIntent(intent, context, rawMessage);
        if (handled) return handled;
      }
    } catch {
     
    }
  }

  
  const faqAnswer = matchFaq(message, hasCompareIds);
  if (faqAnswer) return { reply: faqAnswer };

  const redirectAnswer = await tryDataQuery(message, context);
  if (redirectAnswer) return redirectAnswer;

  return { reply: FALLBACK_ANSWER };
}
