import { describe, expect, it } from "vitest";
import {
  assignColumns,
  descriptionHeight,
  FUEL_CARD,
  galleryHeight,
  leftBaseHeight,
  MAP_BLOCK,
  rightBaseHeight,
  specsHeight,
  TEMPO_CARD,
} from "./detail-layout";

describe("yükseklik tahminleri (gerçek sayfadan ölçülen değerlere yakın)", () => {
  it("galeri: 2 fotoğrafta 512, 23 fotoğrafta 600", () => {
    expect(galleryHeight(2)).toBe(512);
    expect(galleryHeight(23)).toBe(600);
    expect(galleryHeight(1)).toBe(424);
  });

  it("açıklama: kısa metinde ~100, uzunda en çok ~340", () => {
    expect(descriptionHeight(9)).toBe(104);
    expect(descriptionHeight(0)).toBe(0);
    expect(descriptionHeight(2000)).toBe(340);
  });

  it("teknik özellikler: ölçülen kartlarla ±10 px içinde", () => {
    // Üye ilanı: gruplar 6, 2, 5 satır → ölçülen 708 − harita 261 = 447
    expect(Math.abs(specsHeight([6, 2, 5], 0, false) - 447)).toBeLessThan(15);
    // Arabam ilanı: 6, 7, 7 satır → ölçülen 864 − 261 = 603
    expect(Math.abs(specsHeight([6, 7, 7], 0, false) - 603)).toBeLessThan(15);
  });
});

describe("assignColumns", () => {
  const blocks = (list: Array<[string, number]>) => list.map(([key, height]) => ({ key, height }));

  it("üye ilanı (sağ sütun çok uzun): özellikler ve harita sola, yakıt kartı sağa gider", () => {
    const left = leftBaseHeight(2, 9);
    const right = rightBaseHeight(true);
    const result = assignColumns(blocks([["fuel", FUEL_CARD], ["specs", 455], ["map", MAP_BLOCK]]), left, right);
    expect(result.left).toEqual(["specs", "map"]);
    expect(result.right).toEqual(["fuel"]);
  });

  it("Arabam ilanı (uzun açıklama): özellikler sola, harita ve ikincil kartlar sağa gider; fark bir kartın altında kalır", () => {
    const left = leftBaseHeight(23, 1200);
    const right = rightBaseHeight(false);
    const input = blocks([["tempo", TEMPO_CARD], ["fuel", 115], ["specs", 611], ["map", MAP_BLOCK]]);
    const result = assignColumns(input, left, right);
    expect(result.left).toContain("specs");
    const height = (keys: string[], base: number) => keys.reduce((sum, key) => sum + 20 + input.find((b) => b.key === key)!.height, base);
    const diff = Math.abs(height(result.left, left) - height(result.right, right));
    expect(diff).toBeLessThan(250);
  });

  it("her blok tam bir sütunda yer alır ve sütun içinde verilen sırayı korur", () => {
    const input = blocks([["a", 100], ["b", 400], ["c", 250], ["d", 90]]);
    const result = assignColumns(input, 500, 500);
    expect([...result.left, ...result.right].sort()).toEqual(["a", "b", "c", "d"]);
    const order = (keys: string[]) => keys.map((key) => input.findIndex((b) => b.key === key));
    expect(order(result.left)).toEqual([...order(result.left)].sort((x, y) => x - y));
    expect(order(result.right)).toEqual([...order(result.right)].sort((x, y) => x - y));
  });

  it("blok yoksa iki sütun da boş", () => {
    expect(assignColumns([], 800, 900)).toEqual({ left: [], right: [] });
  });
});
