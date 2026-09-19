import { TR_GEO, TR_PROVINCES } from "@/lib/tr-geo";

export const SELL_COLORS = [
  "Beyaz",
  "Siyah",
  "Gri",
  "Gümüş Gri",
  "Kırmızı",
  "Mavi",
  "Lacivert",
  "Yeşil",
  "Bordo",
  "Turuncu",
  "Sarı",
  "Kahverengi",
  "Bej",
  "Antrasit",
  "Füme",
  "Turkuaz",
  "Mor",
  "Altın",
  "Belirtilmemiş",
];

export const BODY_TYPES = [
  "Sedan",
  "Hatchback",
  "SUV",
  "Station Wagon",
  "Coupe",
  "Cabrio",
  "MPV",
  "Pickup",
  "Belirtilmemiş",
];


export const PROVINCES = TR_PROVINCES;


export function districtsOf(province: string): string[] {
  return TR_GEO[province] || [];
}


export function formatNumberInput(value: string | number): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("tr-TR");
}

/** Biçimli metinden sayıya döner: "1.600.000" → 1600000. */
export function parseNumberInput(value: string): number {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}


export function maskName(fullName: string): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Üye";
  return parts
    .map((part) => {
      const first = [...part][0] || "";
      const rest = [...part].length - 1;
      return rest > 0 ? `${first}${"*".repeat(rest)}` : first;
    })
    .join(" ");
}
