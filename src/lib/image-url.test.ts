import { CARD_IMAGE_SIZE } from "@/lib/image-url";
import { describe, expect, it } from "vitest";


describe("kart boyutu tercihi", () => {
  const url =
    "https://arbstorage.mncdn.com/ilanfotograflari/2026/01/01/x_image_for_silan_1_1920x1080.jpg";

  it("tercih edilen boyutu en başa alır", async () => {
    const { sizeVariants } = await import("@/lib/image-url");
    const out = sizeVariants(url, CARD_IMAGE_SIZE);
    expect(out[0]).toContain(`_${CARD_IMAGE_SIZE}.jpg`);
  });

  it("yedek olarak diğer boyutları KORUR", async () => {
    const { sizeVariants } = await import("@/lib/image-url");
    const out = sizeVariants(url, CARD_IMAGE_SIZE);
    expect(out.some((u) => u.includes("_1920x1080.jpg"))).toBe(true);
    expect(out.length).toBeGreaterThan(1);
  });

  it("boyut deseni olmayan adresi (otomerkezi/data:) bozmaz", async () => {
    const { sizeVariants } = await import("@/lib/image-url");
    const raw = "https://asset.otomerkezi.net/car-photo/1715_foto.jpg";
    expect(sizeVariants(raw, CARD_IMAGE_SIZE)).toEqual([raw]);
  });

  it("imageCandidates tercihi uçtan uca taşır", async () => {
    const { imageCandidates } = await import("@/lib/image-url");
    const out = imageCandidates(url, [], 6, CARD_IMAGE_SIZE);
    expect(out[0]).toContain(`_${CARD_IMAGE_SIZE}.jpg`);
  });
});
import { imageCandidates, sizeVariants } from "./image-url";

const ARABAM =
  "https://arbstorage.mncdn.com/ilanfotograflari/2026/03/24/38982622/10ab609f_image_for_silan_38982622_1920x1080.jpg";
const OTO =
  "https://asset.otomerkezi.net/car-photo/2388_1784294910193_WhatsApp Image 2026-07-17 at 16.09.58 (2).jpeg";

describe("sizeVariants", () => {
  it("arabam URL'si için 800x600 alternatifini üretir", () => {
    const variants = sizeVariants(ARABAM);
    expect(variants[0]).toBe(ARABAM);
    expect(variants).toContain(ARABAM.replace("1920x1080", "800x600"));
  });

  it("mevcut boyutu tekrar denemez", () => {
    const small = ARABAM.replace("1920x1080", "800x600");
    const variants = sizeVariants(small);
    expect(variants.filter((v) => v.includes("800x600"))).toHaveLength(1);
    expect(variants).toContain(ARABAM);
  });

  it("boyut deseni olmayan URL'yi olduğu gibi bırakır", () => {
    expect(sizeVariants(OTO)).toEqual([OTO]);
  });

  it("km/fiyat gibi sayıları boyut sanmaz", () => {
    const url = "https://cdn.example.com/foto/araba-2026.jpg";
    expect(sizeVariants(url)).toEqual([url]);
  });
});

describe("imageCandidates", () => {
  it("ana fotoğrafın varyantlarını galerideki diğer fotoğraflardan ÖNCE dener", () => {
    const other = ARABAM.replace("38982622", "99999999");
    const list = imageCandidates(ARABAM, [other]);
    expect(list[0]).toBe(ARABAM);
    expect(list[1]).toBe(ARABAM.replace("1920x1080", "800x600"));
    expect(list[2]).toBe(other);
  });

  it("tekrarlanan URL'leri eler", () => {
    const list = imageCandidates(ARABAM, [ARABAM, ARABAM]);
    expect(list).toHaveLength(2); 
  });

  it("fotoğraf sayısını sınırlar", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      ARABAM.replace("38982622", String(10000000 + i))
    );
    expect(imageCandidates(many[0], many.slice(1), 3)).toHaveLength(6); // 3 foto × 2 boyut
  });

  it("görsel yoksa boş liste döner", () => {
    expect(imageCandidates(undefined, [])).toEqual([]);
    expect(imageCandidates("", [""])).toEqual([]);
  });
});
