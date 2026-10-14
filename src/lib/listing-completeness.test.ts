import { describe, expect, it } from "vitest";
import { isKnownValue, listingCompleteness, showsListingQuality } from "./listing-completeness";

const photos = (n: number) => Array.from({ length: n }, (_, i) => `https://img.example/${i}.jpg`);
const text = (n: number) => "a".repeat(n);
const full = {
  images: photos(8),
  description: text(250),
  paintChange: "Tamamı orjinal",
  features: { fuelType: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Gri" },
};
const itemOf = (input: object, key: string) => listingCompleteness({ ...full, ...input }).items.find((i) => i.key === key)!;

describe("listingCompleteness", () => {
  it("tam bilgili ilan 100 alır", () => {
    expect(listingCompleteness(full).score).toBe(100);
  });

  it("hiçbir bilgi yoksa 0 alır", () => {
    expect(listingCompleteness({}).score).toBe(0);
  });

  it("fotoğraf sınırları: 1–3 az, 4–7 orta, 8+ tam", () => {
    const at = (n: number) => itemOf({ images: photos(n) }, "fotograf").earned;
    expect([at(0), at(1), at(3), at(4), at(7), at(8)]).toEqual([0, 10, 10, 20, 20, 35]);
  });

  it("açıklama sınırları: 79 karakter 3, 80 karakter 10, 199 karakter 10, 200 karakter 15", () => {
    const at = (n: number) => itemOf({ description: text(n) }, "aciklama").earned;
    expect([at(0), at(79), at(80), at(199), at(200)]).toEqual([0, 3, 10, 10, 15]);
  });

  it("açıklama yalnız boşluktan oluşuyorsa bilgi sayılmaz", () => {
    expect(itemOf({ description: "     " }, "aciklama").earned).toBe(0);
  });

  it("hasar bilgisi: 'Belirtilmemiş' ve boş metin bilgi değildir; parça listesi, açık hasar kaydı ya da boya metni bilgi sayılır", () => {
    const damage = (input: object) => itemOf({ paintChange: undefined, ...input }, "hasar").earned;
    expect(damage({ paintChange: "Belirtilmemiş" })).toBe(0);
    expect(damage({ paintChange: "" })).toBe(0);
    expect(damage({ damageFlag: false })).toBe(0);
    expect(damage({ damageFlag: true })).toBe(25);
    expect(damage({ damageParts: [{ part: "kapı" }] })).toBe(25);
    expect(damage({ paintChange: "1 boyalı" })).toBe(25);
  });

  it("özellikler: 'Bilinmiyor', 'Belirtilmemiş' ve 'Doğrulanıyor' bilinmiyor sayılır; eksik alan ağırlığı kadar düşer", () => {
    const features = (f: Record<string, string>) =>
      itemOf({ features: { fuelType: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Gri", ...f } }, "ozellikler");
    expect(features({ fuelType: "Bilinmiyor" }).earned).toBe(18);
    expect(features({ bodyType: "Belirtilmemiş" }).earned).toBe(19);
    expect(features({ color: "Doğrulanıyor" }).earned).toBe(19);
    expect(features({ fuelType: "Bilinmiyor" }).note).toBe("Eksik: Yakıt");
  });

  it("puan dökümü toplamı skoru verir ve her kalem en fazla kendi maksimumunu alır", () => {
    const result = listingCompleteness({ images: photos(3), description: text(90), damageFlag: true, features: { fuelType: "Dizel" } });
    expect(result.items.reduce((sum, i) => sum + i.earned, 0)).toBe(result.score);
    for (const item of result.items) expect(item.earned).toBeLessThanOrEqual(item.max);
    expect(result.score).toBe(10 + 10 + 25 + 7);
  });

  it("bilinmiyor kontrolü boş ve yalnız boşluk içeren metni bilinmiyor sayar", () => {
    expect(isKnownValue(null)).toBe(false);
    expect(isKnownValue("   ")).toBe(false);
    expect(isKnownValue("Gri")).toBe(true);
  });
});

describe("showsListingQuality", () => {
  it("yalnızca yayındaki ve güvenilir çekilen kaynağın ilanında gösterilir", () => {
    expect(showsListingQuality({ status: "active", sourceSite: "arabam" })).toBe(true);
    expect(showsListingQuality({ status: "active", sourceSite: "user" })).toBe(true);
    expect(showsListingQuality({ status: "removed", sourceSite: "arabam" })).toBe(false);
    expect(showsListingQuality({ status: "sold", sourceSite: "user" })).toBe(false);
    // Otomerkezi: kaynakta 404 veren ilanlar ve eksik galeri/hasar verisi nedeniyle puan gösterilmez.
    expect(showsListingQuality({ status: "active", sourceSite: "otomerkezi" })).toBe(false);
  });
});
