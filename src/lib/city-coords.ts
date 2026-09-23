import { TR_PROVINCE_CENTERS } from "@/lib/tr-districts";


const CITY_OVERRIDES: Record<string, { lat: number; lng: number }> = {
  adana: { lat: 37.0, lng: 35.3213 },
  adiyaman: { lat: 37.7648, lng: 38.2786 },
  afyonkarahisar: { lat: 38.7507, lng: 30.5567 },
  ankara: { lat: 39.9334, lng: 32.8597 },
  antalya: { lat: 36.8969, lng: 30.7133 },
  aydin: { lat: 37.856, lng: 27.8416 },
  balikesir: { lat: 39.6484, lng: 27.8826 },
  batman: { lat: 37.8812, lng: 41.1351 },
  bolu: { lat: 40.576, lng: 31.5788 },
  bursa: { lat: 40.1885, lng: 29.061 },
  canakkale: { lat: 40.1553, lng: 26.4142 },
  corum: { lat: 40.5506, lng: 34.9556 },
  denizli: { lat: 37.7765, lng: 29.0864 },
  diyarbakir: { lat: 37.9144, lng: 40.2306 },
  duzce: { lat: 40.8438, lng: 31.1565 },
  edirne: { lat: 41.6818, lng: 26.5623 },
  elazig: { lat: 38.681, lng: 39.2264 },
  erzurum: { lat: 39.9, lng: 41.27 },
  eskisehir: { lat: 39.7767, lng: 30.5206 },
  gaziantep: { lat: 37.0662, lng: 37.3833 },
  hatay: { lat: 36.4018, lng: 36.3498 },
  isparta: { lat: 37.7648, lng: 30.5566 },
  istanbul: { lat: 41.0082, lng: 28.9784 },
  izmir: { lat: 38.4237, lng: 27.1428 },
  kahramanmaras: { lat: 37.5858, lng: 36.9371 },
  kayseri: { lat: 38.7312, lng: 35.4787 },
  kirklareli: { lat: 41.7333, lng: 27.2167 },
  kirsehir: { lat: 39.1425, lng: 34.1709 },
  kocaeli: { lat: 40.7654, lng: 29.9408 },  
  konya: { lat: 37.8667, lng: 32.4833 },
  kutahya: { lat: 39.4167, lng: 29.9833 },
  malatya: { lat: 38.3552, lng: 38.3095 },
  manisa: { lat: 38.6191, lng: 27.4289 },
  mardin: { lat: 37.3212, lng: 40.7245 },
  mersin: { lat: 36.8, lng: 34.6333 },
  mugla: { lat: 37.2153, lng: 28.3636 },
  nevsehir: { lat: 38.6939, lng: 34.6857 },
  ordu: { lat: 40.9839, lng: 37.8764 },
  osmaniye: { lat: 37.0742, lng: 36.2478 },
  rize: { lat: 41.0201, lng: 40.5234 },
  sakarya: { lat: 40.7569, lng: 30.3783 },
  samsun: { lat: 41.2928, lng: 36.3313 },
  sanliurfa: { lat: 37.1591, lng: 38.7969 },
  sivas: { lat: 39.7477, lng: 37.0179 },
  tekirdag: { lat: 40.9833, lng: 27.5167 },
  tokat: { lat: 40.3167, lng: 36.5544 },
  trabzon: { lat: 41.0015, lng: 39.7178 },
  usak: { lat: 38.6823, lng: 29.4082 },
  van: { lat: 38.4891, lng: 43.4089 },
  yalova: { lat: 40.65, lng: 29.2667 },
  yozgat: { lat: 39.82, lng: 34.8044 },
  zonguldak: { lat: 41.4564, lng: 31.7987 },
};


const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  ...TR_PROVINCE_CENTERS,
  ...CITY_OVERRIDES,
};

const TURKEY_CENTER = { lat: 39.0, lng: 35.0 };

function normalizeCity(city: string) {
  return city
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .trim();
}

export function cityToCoords(city: string): { lat: number; lng: number } | null {
  const key = normalizeCity(city);
  if (CITY_COORDS[key]) return CITY_COORDS[key];

  const partial = Object.keys(CITY_COORDS).find((name) => key.includes(name));
  return partial ? CITY_COORDS[partial] : null;
}


export function spreadAroundCity(
  base: { lat: number; lng: number },
  index: number
): { lat: number; lng: number } {
  if (index === 0) return base;
  const angle = index * 2.39996; 
  const radius = 0.012 + 0.006 * Math.sqrt(index);
  return {
    lat: base.lat + radius * Math.sin(angle),
    lng: base.lng + radius * Math.cos(angle) * 1.3,
  };
}

export { TURKEY_CENTER };
