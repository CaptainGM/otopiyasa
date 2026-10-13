/**
 * Fiyat tahmini formundaki araç parça şablonunun verisi (bkz. components/InteractiveDamageSelector.tsx): parça listesi, şablondaki
 * bölge geometrisi ve etiketlerin yeri. Bileşenden ayrı tutulur ki yerleşim kuralları (etiket aralığı, ok ucu) test edilebilsin.
 */

export type PartState = "orijinal" | "boyali" | "degisen";

export interface CarPart {
  id: string;
  name: string;
  state: PartState;
}

export const INITIAL_PARTS: CarPart[] = [
  { id: "kaput", name: "Ön Kaput", state: "orijinal" },
  { id: "tavan", name: "Tavan", state: "orijinal" },
  { id: "bagaj", name: "Bagaj Kapağı", state: "orijinal" },
  { id: "sol_on_camurluk", name: "Sol Ön Çamurluk", state: "orijinal" },
  { id: "sol_on_kapi", name: "Sol Ön Kapı", state: "orijinal" },
  { id: "sol_arka_kapi", name: "Sol Arka Kapı", state: "orijinal" },
  { id: "sol_arka_camurluk", name: "Sol Arka Çamurluk", state: "orijinal" },
  { id: "sag_on_camurluk", name: "Sağ Ön Çamurluk", state: "orijinal" },
  { id: "sag_on_kapi", name: "Sağ Ön Kapı", state: "orijinal" },
  { id: "sag_arka_kapi", name: "Sağ Arka Kapı", state: "orijinal" },
  { id: "sag_arka_camurluk", name: "Sağ Arka Çamurluk", state: "orijinal" },
];

export const VIEW_W = 340;
export const VIEW_H = 420;
/** Yan etiket sütununun genişliği (şema genişliğinin oranı); ok bu sütunun iç kenarından bölgeye gider. */
export const LABEL_COLUMN = 0.29;

export interface Region {
  id: string;
  /** Üstten görünümde bölgenin dikdörtgeni (viewBox birimi). */
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  /** Okun bölgedeki ucu. */
  target: { x: number; y: number };
  /** Etiketin yeri: yan sütunlarda dikey konum, üst/alt etiketlerde şemanın ortası. */
  label: { side: "left" | "right" | "top" | "bottom"; y: number };
}

/** Araç üstten bakışla: ortada kaput-tavan-bagaj, iki yanda çamurluk ve kapılar. */
export const REGIONS: Region[] = [
  { id: "kaput", x: 146, y: 62, w: 48, h: 66, r: 18, target: { x: 170, y: 90 }, label: { side: "top", y: 26 } },
  { id: "tavan", x: 146, y: 144, w: 48, h: 94, r: 8, target: { x: 176, y: 190 }, label: { side: "right", y: 222 } },
  { id: "bagaj", x: 146, y: 254, w: 48, h: 68, r: 18, target: { x: 170, y: 290 }, label: { side: "bottom", y: 394 } },
  // Etiketler üç satıra kadar uzar (ad iki satır + durum): komşu etiketler arası en az ~62 birim bırakılır, yoksa dar ekranda üst üste biner.
  { id: "sol_on_camurluk", x: 120, y: 74, w: 22, h: 62, r: 10, target: { x: 131, y: 105 }, label: { side: "left", y: 88 } },
  { id: "sol_on_kapi", x: 120, y: 140, w: 22, h: 58, r: 6, target: { x: 131, y: 169 }, label: { side: "left", y: 164 } },
  { id: "sol_arka_kapi", x: 120, y: 202, w: 22, h: 58, r: 6, target: { x: 131, y: 231 }, label: { side: "left", y: 240 } },
  { id: "sol_arka_camurluk", x: 120, y: 264, w: 22, h: 60, r: 10, target: { x: 131, y: 294 }, label: { side: "left", y: 316 } },
  { id: "sag_on_camurluk", x: 198, y: 74, w: 22, h: 62, r: 10, target: { x: 209, y: 105 }, label: { side: "right", y: 70 } },
  { id: "sag_on_kapi", x: 198, y: 140, w: 22, h: 58, r: 6, target: { x: 209, y: 169 }, label: { side: "right", y: 146 } },
  { id: "sag_arka_kapi", x: 198, y: 202, w: 22, h: 58, r: 6, target: { x: 209, y: 231 }, label: { side: "right", y: 298 } },
  { id: "sag_arka_camurluk", x: 198, y: 264, w: 22, h: 60, r: 10, target: { x: 209, y: 294 }, label: { side: "right", y: 374 } },
];

/** Okun etikete bağlandığı nokta (viewBox birimi). */
export function labelAnchor(region: Region): { x: number; y: number } {
  const { side, y } = region.label;
  if (side === "left") return { x: VIEW_W * LABEL_COLUMN, y };
  if (side === "right") return { x: VIEW_W * (1 - LABEL_COLUMN), y };
  return { x: VIEW_W / 2, y: side === "top" ? y + 16 : y - 16 };
}
