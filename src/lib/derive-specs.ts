import { CarFeatures } from "@/types";


export const COLORS = [
  "Gümüş Gri", "Buz Beyazı", "Sedef Beyaz", "İnci Beyaz", "Gece Mavisi",
  "Kahverengi", "Şampanya", "Antrasit", "Turkuaz", "Lacivert", "Gümüş",
  "Bordo", "Beyaz", "Siyah", "Kırmızı", "Turuncu", "Yeşil", "Mavi", "Sarı",
  "Füme", "Altın", "Pembe", "Bej", "Gri", "Mor",
];


export function deriveColor(...texts: (string | undefined)[]): string | undefined {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  for (const color of COLORS) {
    if (hay.includes(color.toLowerCase())) return color;
  }
  return undefined;
}


export function deriveEngineSize(...texts: (string | undefined)[]): number | undefined {
  const hay = texts.filter(Boolean).join(" ");
  const match = hay.match(/(?<![\d.,])([0-6])[.,](\d)(?!\d)/);
  if (!match) return undefined;
  const value = Number(`${match[1]}.${match[2]}`);
  return value >= 0.6 && value <= 6.5 ? value : undefined;
}


const AWD_KEYWORDS = [
  "quattro", "xdrive", "x-drive", "4matic", "4-matic", "4motion",
  "4wd", "awd", "4x4", "4×4", "4 çeker", "dört çeker", "allrad",
];


export function deriveDrivetrain(...texts: (string | undefined)[]): string | undefined {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  return AWD_KEYWORDS.some((k) => hay.includes(k)) ? "4x4" : undefined;
}


function isBlank(value?: string): boolean {
  const v = (value || "").trim();
  return v === "" || v === "Belirtilmemiş" || v === "Bilinmiyor";
}


export function enrichFeatures(
  features: CarFeatures,
  title?: string,
  description?: string
): CarFeatures {
  const enriched: CarFeatures = { ...features };

  if (isBlank(enriched.color)) {
    const color = deriveColor(title, description);
    if (color) enriched.color = color;
  }
  if (!enriched.engineSize || enriched.engineSize <= 0) {
    const size = deriveEngineSize(title, description);
    if (size) enriched.engineSize = size;
  }
  if (isBlank(enriched.drivetrain)) {
    const drivetrain = deriveDrivetrain(title, description);
    if (drivetrain) enriched.drivetrain = drivetrain;
  }

  return enriched;
}
