
import { cityToCoords } from "@/lib/city-coords";
import { TR_DISTRICTS } from "@/lib/tr-districts";
import { DISTRICT_EXTRA } from "@/lib/district-extra";

interface DistrictPoint {
  name: string;
  lat: number;
  lng: number;
}


function mergeDistricts(
  ...sources: Record<string, DistrictPoint[]>[]
): Record<string, DistrictPoint[]> {
  const merged: Record<string, DistrictPoint[]> = {};
  for (const source of sources) {
    for (const [province, list] of Object.entries(source)) {
      const target = (merged[province] ||= []);
      for (const point of list) {
        if (!target.some((existing) => existing.name === point.name)) target.push(point);
      }
    }
  }
  
  for (const list of Object.values(merged)) {
    list.sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name));
  }
  return merged;
}

const DISTRICTS: Record<string, DistrictPoint[]> = mergeDistricts(TR_DISTRICTS, DISTRICT_EXTRA);


function ascii(s: string): string {
  return (s || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c")
    .toLowerCase()
    .trim();
}


const wordRegexCache = new Map<string, RegExp>();
function containsWord(haystack: string, name: string): boolean {
  let re = wordRegexCache.get(name);
  if (!re) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`);
    wordRegexCache.set(name, re);
  }
  return re.test(haystack);
}


function findDistrict(haystack: string, list: DistrictPoint[]): DistrictPoint | null {
  if (!haystack) return null;
  return list.find((d) => containsWord(haystack, d.name)) || null;
}


function jitter(base: { lat: number; lng: number }, index: number) {
  const angle = index * 2.39996; 
  const r = 0.003 + 0.005 * ((index % 10) / 10); 
  return {
    lat: base.lat + r * Math.sin(angle),
    lng: base.lng + r * Math.cos(angle),
  };
}


function provinceKeyFor(cityAscii: string): string | null {
  if (DISTRICTS[cityAscii]) return cityAscii; 
  for (const province of Object.keys(DISTRICTS)) {
    if (cityAscii.includes(province)) return province;
  }
  return null;
}


const DISTRICT_TO_PROVINCE: Map<string, string> = (() => {
  const seen = new Map<string, string | null>();
  for (const [province, list] of Object.entries(DISTRICTS)) {
    for (const d of list) {
      // Zaten bir il adıysa karıştırma (ör. "bolu" hem il hem merkez ilçe)
      if (DISTRICTS[d.name]) continue;
      seen.set(d.name, seen.has(d.name) ? null : province);
    }
  }
  const unique = new Map<string, string>();
  for (const [name, province] of seen) if (province) unique.set(name, province);
  return unique;
})();


function provinceFromDistrictName(cityAscii: string): { province: string; district: DistrictPoint } | null {
  for (const [name, province] of DISTRICT_TO_PROVINCE) {
    if (!containsWord(cityAscii, name)) continue;
    const district = DISTRICTS[province].find((d) => d.name === name);
    if (district) return { province, district };
  }
  return null;
}

export type Placement = {
  lat: number;
  lng: number;
  level: "district" | "province";
  
  district?: string;
  
  source?: "address" | "description" | "city";
};


export function resolvePlacement(
  city: string,
  address: string | undefined,
  index: number,
  description?: string
): Placement | null {
  const cityKey = ascii(city);
  const province = provinceKeyFor(cityKey);

  if (province) {
    const full = DISTRICTS[province];
 
    const freeText = full.filter((d) => d.name !== province);
    const candidates: [string, DistrictPoint[], Placement["source"]][] = [
      [ascii(address || ""), full, "address"],
      [ascii(description || ""), freeText, "description"],
      [cityKey, freeText, "city"],
    ];

    for (const [haystack, list, source] of candidates) {
      const district = findDistrict(haystack, list);
      if (!district) continue;
      
      const point = index === 0 ? district : jitter(district, index);
      return {
        lat: point.lat,
        lng: point.lng,
        level: "district",
        district: district.name,
        source,
      };
    }
  }

  const center = cityToCoords(city);
  if (center) return { lat: center.lat, lng: center.lng, level: "province" };


  const viaDistrict = provinceFromDistrictName(cityKey);
  if (viaDistrict) {
    const point = index === 0 ? viaDistrict.district : jitter(viaDistrict.district, index);
    return {
      lat: point.lat,
      lng: point.lng,
      level: "district",
      district: viaDistrict.district.name,
      source: "city",
    };
  }

  return null;
}


export function placeListing(
  city: string,
  address: string | undefined,
  index: number,
  description?: string
): { lat: number; lng: number } | null {
  const p = resolvePlacement(city, address, index, description);
  return p ? { lat: p.lat, lng: p.lng } : null;
}
