/**
 * İlan sayfasının üst bölümü iki sütundur: sol sütunda galeri, açıklama ve hasar durumu; sağda başlık, fiyat, analiz ve eylemler.
 * Sağ sütun 1650–1800 px'e uzarken sol 920–1250 px'te kalıyor, altında 400–875 px boşluk oluşuyordu. Boşluk bırakmamak için
 * ikincil kartlar (teknik özellikler, harita, yakıt maliyeti) kısa sütuna konur. Piyasa temposu bu sütunlara girmez: veri yoksa
 * hiç çizilmez, yüksekliği önceden bilinmez; alt kartta gösterilir.
 *
 * Yükseklikler 1440 px genişlikte (kap 1280 px) gerçek sayfadan ölçüldü (13 Ekim 2026) ve verilerden tahmin edilir: tam doğru olması
 * gerekmez, amaç iki sütunun farkını bir kartın boyunun altında tutmaktır. Telefonda tek sütun olduğundan yerleşim görünmez.
 */

/** Hasar / boya kartı. */
const DAMAGE_CARD = 294;
/** Kartlar arası boşluk (space-y-5). */
export const BLOCK_GAP = 20;
/** Galeri ile altındaki sütun arası boşluk (ızgara aralığı). */
const GRID_GAP = 32;

/** Galeri: ana fotoğraf + küçük resim satırları (6'şar; 2–6 fotoğrafta 1 satır, daha fazlasında 2 satır). */
export function galleryHeight(imageCount: number): number {
  return 424 + (imageCount >= 2 ? 88 : 0) + (imageCount > 6 ? 88 : 0);
}

/** İlan açıklaması: 500 karakterden uzunsa en çok 224 px görünür ve "tamamını gör" düğmesi eklenir. */
export function descriptionHeight(length: number): number {
  if (length <= 0) return 0;
  const lines = Math.ceil(length / 95);
  return 80 + Math.min(224, lines * 24) + (length > 500 ? 36 : 0);
}

/** Sol sütunun sabit kısmı: galeri + açıklama + hasar durumu. */
export function leftBaseHeight(imageCount: number, descriptionLength: number): number {
  const description = descriptionHeight(descriptionLength);
  return galleryHeight(imageCount) + GRID_GAP + (description > 0 ? description + BLOCK_GAP : 0) + DAMAGE_CARD;
}

/** Sağ sütunun sabit kısmı: başlık, fiyat, analiz, fiyat skalası, eylemler (+ üye ilanında iletişim ve teklif kutusu). */
export function rightBaseHeight(userListing: boolean, showScale = true): number {
  const fixed = 800 + (userListing ? 0 : 80);
  // Fiyat skalası yalnızca yöneticiye çizilir; kullanıcıda bu yükseklik yoksa sağ sütun olduğundan uzun tahmin edilmemeli.
  const scale = showScale ? 430 : 0;
  const contactAndOffer = userListing ? 370 : 0;
  return fixed + scale + contactAndOffer;
}

/** Teknik özellikler kartı (haritasız): özellik grupları (satır sayıları) ve varsa güvenlik donanımı etiketleri. */
export function specsHeight(groupRows: number[], safetyItems: number, hasSource: boolean): number {
  const groups = groupRows.reduce((sum, rows) => sum + 28 + (39 * Math.ceil(rows / 2) - 10), 0) + BLOCK_GAP * Math.max(0, groupRows.length - 1);
  const safety = safetyItems > 0 ? BLOCK_GAP + 28 + 34 * Math.ceil(safetyItems / 5) : 0;
  return 88 + groups + safety + (hasSource ? 24 : 0);
}

/** Konum haritası bloğu (başlık + harita). Sütunun son bloğu olduğu için sütundaki kalan boyu doldurur. */
export const MAP_BLOCK = 261;
/** Yakıt maliyeti kartı (ölçülen ortalama). */
export const FUEL_CARD = 150;

export interface LayoutBlock {
  key: string;
  height: number;
}

/**
 * Hareketli blokları (yüksekliğe göre azalan sırayla) o an kısa olan sütuna koyar; her sütunda bloklar verilen sırayı korur.
 * Eşitlikte sol sütun seçilir.
 */
export function assignColumns(
  blocks: LayoutBlock[],
  leftBase: number,
  rightBase: number
): { left: string[]; right: string[] } {
  let left = leftBase;
  let right = rightBase;
  const side = new Map<string, "left" | "right">();
  for (const block of [...blocks].sort((a, b) => b.height - a.height)) {
    if (left <= right) {
      side.set(block.key, "left");
      left += BLOCK_GAP + block.height;
    } else {
      side.set(block.key, "right");
      right += BLOCK_GAP + block.height;
    }
  }
  return {
    left: blocks.filter((block) => side.get(block.key) === "left").map((block) => block.key),
    right: blocks.filter((block) => side.get(block.key) === "right").map((block) => block.key),
  };
}
