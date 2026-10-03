import type { DamagePart } from "@/lib/scraper/browser-scrape";
import { normalizeFuelType } from "@/lib/normalize-fuel";

/**
 * İLAN SAYFASI OKUNAMAYAN KAYNAKLARIN DETAYI (Carvak, DOD, Otomerkezi)
 *
 * Bu üç kaynağın liste verisi ilan başına tek fotoğraf veriyor, hasar bilgisi hiç yok. Detay
 * sayfaları tarayıcıda JavaScript ile doluyor; sitelerin kendi arayüzlerinin kullandığı herkese
 * açık uç noktalar okunur (2026-10 ölçümü):
 *  - Carvak (Kavak altyapısı): `/drago-vip-api/public/dynamic?stockId=…` — galeri, parça bazlı
 *    boya/değişen, tramer kayıtları, beygir, motor hacmi. Ülke başlığı olmadan 500 döner.
 *  - DOD: `gw.dod.com.tr/gw-advertisement/{getVehicleImages,getExpertiseDetail,getAdvertisementVehicle}`
 *    — galeri, boyanan/değişen parçalar, beygir, motor hacmi, resmi şehir içi/dışı tüketim.
 *  - Otomerkezi: aynı model-yıl için tek adres kullanılıyor ve sayfa yalnızca bir aracı gösteriyor;
 *    sayfadaki aracın numarası bizimkiyle aynıysa galeri ve ekspertiz şeması alınır, değilse
 *    (başka araca ait sayfa) hiçbir şey yazılmaz.
 */
export interface ExtraDetail {
  images?: string[];
  damageParts?: DamagePart[];
  paintChange?: string;
  damageFlag?: boolean;
  description?: string;
  color?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  engineSize?: number;
  horsepower?: number;
  avgFuelConsumption?: string;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_IMAGES = 40;
const uniq = (list: string[]) => [...new Set(list.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)))].slice(0, MAX_IMAGES);
const fmt1 = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Parça durumlarından özet: "2 boyalı, 1 değişen" ya da "Boya/değişen yok". */
export function summarizeParts(parts: DamagePart[]): string {
  const painted = parts.filter((p) => p.state === "Boyanmış").length;
  const local = parts.filter((p) => p.state === "Lokal Boyanmış").length;
  const changed = parts.filter((p) => p.state === "Değişmiş").length;
  const bits = [changed ? `${changed} değişen` : "", painted ? `${painted} boyalı` : "", local ? `${local} lokal boyalı` : ""].filter(Boolean);
  return bits.length ? bits.join(", ") : "Boya/değişen yok";
}

/** Kaynakların farklı durum kodlarını sitedeki tek sözlüğe çevirir. */
export function normalizePartState(raw?: string | null): string | null {
  const v = (raw || "").toLocaleLowerCase("tr-TR");
  if (!v) return null;
  if (/local|lokal/.test(v)) return "Lokal Boyanmış";
  if (/modif|chang|replac|değiş|degis/.test(v)) return "Değişmiş";
  if (/paint|boya/.test(v)) return "Boyanmış";
  if (/^ok$|original|orijinal|^o$/.test(v)) return "Orijinal";
  return null;
}

const PART_WORDS: Array<[RegExp, string]> = [
  [/bumper/i, "Tampon"],
  [/hood|bonnet/i, "Motor Kaputu"],
  [/trunk|tailgate|boot/i, "Bagaj Kapağı"],
  [/roof/i, "Tavan"],
  [/fender/i, "Çamurluk"],
  [/door/i, "Kapı"],
  [/pillar/i, "Direk"],
  // Carvak: "rightRunningBoard" basamak/marşpiyel; "rightFragrantSheet" kaynağın kendi adı, anlamı belirsiz bir yan sac.
  [/rocker|sill|marsp|runningboard/i, "Marşpiyel"],
  [/fragrantsheet/i, "Yan Sac"],
];

/** Carvak parça kodu ("leftFrontDoor", "rightPillarA") → hasar şemasının tanıdığı Türkçe ad. */
export function carvakPartName(code: string): string {
  const side = /^left/i.test(code) ? "Sol " : /^right/i.test(code) ? "Sağ " : "";
  const pos = /front/i.test(code) ? "Ön " : /back|rear/i.test(code) ? "Arka " : "";
  const word = PART_WORDS.find(([re]) => re.test(code))?.[1];
  if (!word) return code;
  if (word === "Motor Kaputu" || word === "Bagaj Kapağı" || word === "Tavan") return word;
  if (word === "Direk") {
    const letter = (code.match(/Pillar([A-Z])/) || [])[1];
    return `${side}${letter ? `${letter} Direği` : "Direk"}`;
  }
  return `${side}${pos}${word}`;
}

// ---------------------------------------------------------------------------
// CARVAK
// ---------------------------------------------------------------------------

export function parseCarvakDynamic(json: any, title = ""): ExtraDetail | null {
  const main = json?.data?.mainResult;
  if (!main?.car_id) return null;
  const images = uniq(json?.media?.gallery?.images || []);

  const parts: DamagePart[] = [];
  for (const p of json?.dimples?.parts || []) {
    const state = normalizePartState(p?.statusCode);
    if (p?.partCode && state) parts.push({ name: carvakPartName(p.partCode), state });
  }
  const accidents: Array<{ amount?: string; date?: string; type?: string }> = json?.dimples?.accidents || [];
  // Galeri ve ekspertiz yoksa (satılmış/yayından kalkmış araç) yazılacak bir şey yok.
  if (!images.length && !parts.length) return null;

  const items: Array<{ code?: string; value?: string }> = (json?.features?.types || []).flatMap((t: any) => t?.items || []);
  const feature = (code: string) => items.find((i) => i.code === code)?.value;
  const hp = Number(feature("performance.max_power_hp"));
  const liters = Number(String(feature("engine.liters") || "").replace(",", "."));
  const fuel = feature("fuel.type") || main.fuel_type;

  const paintChange = parts.length ? summarizeParts(parts) : undefined;
  const tramer = accidents.length
    ? `Tramer kaydı: ${accidents.map((a) => [a.date, a.type, a.amount].filter(Boolean).join(" ")).join("; ")}.`
    : "Tramer kaydı bildirilmemiş.";
  const name = title || [main.car_make, main.car_model, main.car_trim, main.car_year].filter(Boolean).join(" ");

  return {
    images: images.length ? images : undefined,
    damageParts: parts.length ? parts : undefined,
    paintChange,
    damageFlag: accidents.length > 0,
    description: [`${name} — Carvak ekspertizli ikinci el araç.`, paintChange ? `Kaporta: ${paintChange.toLocaleLowerCase("tr-TR")}.` : "", tramer]
      .filter(Boolean)
      .join(" "),
    color: main.ext_color || undefined,
    bodyType: main.body_type || feature("body_style.local_body_type") || undefined,
    fuelType: fuel ? normalizeFuelType(fuel) : undefined,
    transmission: main.transmission || undefined,
    engineSize: Number.isFinite(liters) && liters > 0 && liters < 10 ? liters : undefined,
    horsepower: Number.isFinite(hp) && hp > 30 ? hp : undefined,
  };
}

async function fetchCarvak(url: string, title?: string): Promise<ExtraDetail | null> {
  const stockId = url.match(/[?&]id=(\d+)/)?.[1];
  if (!stockId) return null;
  const res = await fetch(`https://carvak.com/drago-vip-api/public/dynamic?stockId=${stockId}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "kavak-client-type": "web",
      "kavak-country-acronym": "tr",
      Referer: url,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  return parseCarvakDynamic(await res.json(), title);
}

// ---------------------------------------------------------------------------
// DOD
// ---------------------------------------------------------------------------

const DOD_GW = "https://gw.dod.com.tr/gw-advertisement";

async function dodPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${DOD_GW}/${path}`, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json", Origin: "https://dod.com.tr", Referer: "https://dod.com.tr/" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.success ? json.data : null;
}

export function parseDodDetail(imagesData: any, expertise: any, vehicle: any, title = ""): ExtraDetail | null {
  const images = uniq(
    (Array.isArray(imagesData) ? imagesData : [])
      .sort((a: any, b: any) => (a?.orderNo ?? 0) - (b?.orderNo ?? 0))
      .map((i: any) => i?.imagePathBig || i?.imagePath)
  );
  const v = Array.isArray(vehicle) ? vehicle[0] : vehicle;
  if (!images.length && !expertise && !v) return null;

  const parts: DamagePart[] = [];
  const add = (list: unknown, state: string) => {
    for (const name of Array.isArray(list) ? list : []) {
      if (typeof name === "string" && name.trim() && !parts.some((p) => p.name === name.trim())) parts.push({ name: name.trim(), state });
    }
  };
  add(expertise?.changedPart, "Değişmiş");
  add(expertise?.paintedPart, "Boyanmış");
  add(expertise?.localPaintedPart, "Lokal Boyanmış");
  const minor = [...(expertise?.scratchedPart || []), ...(expertise?.crushedPart || [])].filter((p: unknown) => typeof p === "string" && p.trim());

  // Resmi karma tüketim yaklaşık olarak şehir içi %37, şehir dışı %63 ağırlıkla hesaplanır (NEDC).
  const inner = Number(v?.fuelConsumptionInnerCity);
  const outer = Number(v?.fuelConsumptionOuterCity);
  const combined = inner > 0 && outer > 0 ? Math.round((inner * 0.37 + outer * 0.63) * 10) / 10 : undefined;

  const paintChange = expertise ? summarizeParts(parts) : undefined;
  const status = typeof expertise?.vehicleExpertiseStatus === "string" ? expertise.vehicleExpertiseStatus.trim() : "";
  const name = title || [v?.brandName, v?.modelName, v?.modelTypeCode, v?.modelYear].filter(Boolean).join(" ");

  return {
    images: images.length ? images : undefined,
    damageParts: parts.length ? parts : undefined,
    paintChange,
    description: [
      `${name.trim()} — DOD ekspertizli ikinci el araç.`,
      status,
      paintChange ? `Kaporta: ${paintChange.toLocaleLowerCase("tr-TR")}.` : "",
      minor.length ? `Çizik/ezik: ${[...new Set(minor)].join(", ")}.` : "",
      v?.warrantyStatusDefinition ? `Garanti: ${v.warrantyStatusDefinition}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    color: v?.color || undefined,
    bodyType: v?.bodyTypeExplanation ? v.bodyTypeExplanation.charAt(0).toLocaleUpperCase("tr-TR") + v.bodyTypeExplanation.slice(1) : undefined,
    fuelType: v?.fuelTypeDefinition ? normalizeFuelType(v.fuelTypeDefinition) : undefined,
    transmission: v?.gearTypeDefinition || undefined,
    engineSize: Number(v?.ccTypeDefinitionDouble) > 0 ? Number(v.ccTypeDefinitionDouble) : undefined,
    horsepower: Number(v?.maxPowerHP) > 30 ? Number(v.maxPowerHP) : undefined,
    avgFuelConsumption: combined ? `${fmt1(combined)} lt` : undefined,
  };
}

async function fetchDod(url: string, externalId?: string, title?: string): Promise<ExtraDetail | null> {
  const fileNumber = (externalId || "").match(/(\d{6,})$/)?.[1] || url.match(/(\d{6,})\/?$/)?.[1];
  if (!fileNumber) return null;
  const [images, expertise, vehicle] = await Promise.all([
    dodPost("getVehicleImages", { fileNumber }).catch(() => null),
    dodPost("getExpertiseDetail", { FileNumber: fileNumber }).catch(() => null),
    dodPost("getAdvertisementVehicle", { fileNumber }).catch(() => null),
  ]);
  return parseDodDetail(images, expertise, vehicle, title);
}

// ---------------------------------------------------------------------------
// OTOMERKEZİ
// ---------------------------------------------------------------------------

export function parseOtomerkeziDetail(html: string, vehicleId: string): ExtraDetail | null {
  const u = html.replace(/\\(["\\])/g, "$1");
  // Sayfanın ana aracı, galerisi ilk sırada gelen araçtır; numarası bizimkiyle aynı olmalı.
  const gallery = u.match(/"images":\[("https:\/\/asset\.otomerkezi\.net\/car-photo\/(\d+)_[^\]]*)\]/);
  if (!gallery || gallery[2] !== vehicleId) return null;
  const images = uniq(gallery[1].split(/","/).map((s) => s.replace(/^"|"$/g, "")));

  const parts: DamagePart[] = [];
  for (const m of u.matchAll(/"key":"([a-zA-Z]+)","label":"([^"]+)","status":"([a-z_]+)"/g)) {
    const state = normalizePartState(m[3]);
    if (state && !parts.some((p) => p.name === m[2])) parts.push({ name: m[2], state });
  }
  const text = u.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const damageRecord = (text.match(/Toplam Hasar Kaydı:\s*([^H]{1,60}?)\s+Hasar Detayı/) || [])[1]?.trim();

  return {
    images: images.length ? images : undefined,
    damageParts: parts.length ? parts : undefined,
    paintChange: parts.length ? summarizeParts(parts) : undefined,
    ...(damageRecord && !/bilgi yok/i.test(damageRecord) ? { damageFlag: !/yok|0\s*₺?$/i.test(damageRecord) } : {}),
  };
}

async function fetchOtomerkezi(url: string, externalId?: string): Promise<ExtraDetail | null> {
  const vehicleId = (externalId || "").match(/-(\d+)$/)?.[1];
  if (!vehicleId) return null;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  return parseOtomerkeziDetail(await res.text(), vehicleId);
}

export const EXTRA_DETAIL_SOURCES = ["carvak", "dod", "otomerkezi"] as const;

export async function fetchExtraDetail(source: string, url: string, externalId?: string, title?: string): Promise<ExtraDetail | null> {
  if (source === "carvak") return fetchCarvak(url, title);
  if (source === "dod") return fetchDod(url, externalId, title);
  if (source === "otomerkezi") return fetchOtomerkezi(url, externalId);
  return null;
}
