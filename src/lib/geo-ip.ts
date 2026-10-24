const COUNTRY_NAMES: Record<string, string> = {
  TR: "Türkiye",
  DE: "Almanya",
  CN: "Çin",
  US: "Amerika Birleşik Devletleri",
  GB: "İngiltere",
  NL: "Hollanda",
  FR: "Fransa",
  RU: "Rusya",
  AZ: "Azerbaycan",
  IT: "İtalya",
  ES: "İspanya",
  UA: "Ukrayna",
  PL: "Polonya",
  AT: "Avusturya",
  CH: "İsviçre",
  BE: "Belçika",
  SE: "İsveç",
  NO: "Norveç",
  DK: "Danimarka",
  FI: "Finlandiya",
  GR: "Yunanistan",
  BG: "Bulgaristan",
  RO: "Romanya",
  GE: "Gürcistan",
  IR: "İran",
  IQ: "Irak",
  SY: "Suriye",
  SA: "Suudi Arabistan",
  AE: "Birleşik Arap Emirlikleri",
  QA: "Katar",
  KZ: "Kazakistan",
  UZ: "Özbekistan",
  TM: "Türkmenistan",
  KG: "Kırgızistan",
  IN: "Hindistan",
  JP: "Japonya",
  KR: "Güney Kore",
  CA: "Kanada",
  AU: "Avustralya",
  BR: "Brezilya",
  CY: "Kıbrıs",
  T1: "Tor Ağı",
  XX: "Bilinmiyor",
};

export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2 || code === "XX" || code === "T1") return "🌐";
  try {
    const upper = code.toUpperCase();
    const offset = 127397;
    return String.fromCodePoint(upper.charCodeAt(0) + offset, upper.charCodeAt(1) + offset);
  } catch {
    return "🌐";
  }
}

export function getFlagUrl(code: string): string {
  if (!code || code.length !== 2 || code === "XX" || code === "T1") {
    return "";
  }
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

export function getCountryName(code: string): string {
  if (!code) return "Bilinmiyor";
  const upper = code.toUpperCase();
  return COUNTRY_NAMES[upper] || upper;
}

export interface GeoInfo {
  country: string;
  countryName: string;
  flag: string;
  flagUrl: string;
  city: string;
}

const geoCache = new Map<string, GeoInfo>();

export function extractClientIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "127.0.0.1";
}

export async function resolveGeo(ip: string, headers: Headers): Promise<GeoInfo> {
  const cleanIp = ip.trim();
  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp)!;
  }

  // 1. Cloudflare / Render başlıkları varsa 0 ms'de anında kullan:
  const cfCountry = headers.get("cf-ipcountry");
  const cfCity = headers.get("cf-ipcity");
  if (cfCountry && cfCountry.length === 2 && cfCountry !== "XX") {
    const code = cfCountry.toUpperCase();
    const info: GeoInfo = {
      country: code,
      countryName: getCountryName(code),
      flag: countryCodeToFlag(code),
      flagUrl: getFlagUrl(code),
      city: cfCity ? decodeURIComponent(cfCity) : "",
    };
    if (geoCache.size < 5000) geoCache.set(cleanIp, info);
    return info;
  }

  // 2. Yerel / loopback IP kontrolü:
  if (cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp.startsWith("192.168.") || cleanIp.startsWith("10.")) {
    const localInfo: GeoInfo = {
      country: "TR",
      countryName: "Yerel (Geliştirme)",
      flag: "🇹🇷",
      flagUrl: getFlagUrl("TR"),
      city: "Localhost",
    };
    return localInfo;
  }

  // 3. Cloudflare başlığı yoksa hızlı ip-api sorgusu (max 800ms):
  try {
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,city`, {
      signal: AbortSignal.timeout(800),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "success" && data.countryCode) {
        const code = String(data.countryCode).toUpperCase();
        const info: GeoInfo = {
          country: code,
          countryName: getCountryName(code) || data.country || code,
          flag: countryCodeToFlag(code),
          flagUrl: getFlagUrl(code),
          city: data.city || "",
        };
        if (geoCache.size < 5000) geoCache.set(cleanIp, info);
        return info;
      }
    }
  } catch {
    // Ağ zaman aşımı vb. durumunda sessizce devam
  }

  const fallback: GeoInfo = {
    country: "XX",
    countryName: "Bilinmiyor",
    flag: "🌐",
    flagUrl: "",
    city: "",
  };
  return fallback;
}

export function parseUserAgent(uaString: string): {
  device: "desktop" | "mobile" | "tablet" | "bot" | "other";
  browser: string;
  os: string;
  isBot: boolean;
  botName: string;
} {
  const ua = uaString || "";

  // Bot / Web Crawler tespiti:
  if (/googlebot/i.test(ua)) return { device: "bot", browser: "Googlebot", os: "Bot", isBot: true, botName: "Googlebot" };
  if (/baiduspider/i.test(ua)) return { device: "bot", browser: "Baidu Spider", os: "Bot", isBot: true, botName: "Baidu Spider" };
  if (/bingbot/i.test(ua)) return { device: "bot", browser: "Bingbot", os: "Bot", isBot: true, botName: "Bingbot" };
  if (/yandex/i.test(ua)) return { device: "bot", browser: "YandexBot", os: "Bot", isBot: true, botName: "YandexBot" };
  if (/ahrefsbot/i.test(ua)) return { device: "bot", browser: "AhrefsBot", os: "Bot", isBot: true, botName: "AhrefsBot" };
  if (/semrush/i.test(ua)) return { device: "bot", browser: "SemrushBot", os: "Bot", isBot: true, botName: "SemrushBot" };
  if (/bytespider/i.test(ua)) return { device: "bot", browser: "ByteSpider (TikTok)", os: "Bot", isBot: true, botName: "ByteSpider" };
  if (/bot|crawl|spider|slurp|curl|wget|python|headless|httpclient/i.test(ua)) {
    return { device: "bot", browser: "Bot / Tarayıcı", os: "Bot", isBot: true, botName: "Otomatik Bot" };
  }

  // Cihaz türü:
  let device: "desktop" | "mobile" | "tablet" | "other" = "desktop";
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) {
    device = "tablet";
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) {
    device = "mobile";
  }

  // Tarayıcı:
  let browser = "Diğer";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";

  // İşletim sistemi:
  let os = "Diğer";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { device, browser, os, isBot: false, botName: "" };
}
