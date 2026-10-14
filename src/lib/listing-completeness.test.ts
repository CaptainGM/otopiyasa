import { describe, expect, it } from "vitest";
import { isKnownValue, listingCompleteness, showsListingQuality } from "./listing-completeness";

const photos = (n: number) => Array.from({ length: n }, (_, i) => `https://img.example/${i}.jpg`);
const text = (n: number) => "a".repeat(n);
/** Altı bilgi konusunu da içeren, 300 karakteri aşan açıklama. "Araç temiz kullanılmıştır" hiçbir konuya girmez. */
const topicText =
  "Bakım geçmişi düzenli, fatura var. Boya ve değişen parça bilgisi açık. Deri koltuk, navigasyon donanımlı. " +
  "Tek sahipli, garaj. Muayene ruhsat tam. Lastik ve fren yeni. " + "Araç temiz kullanılmıştır. ".repeat(6);
const full = {
  images: photos(10),
  description: topicText,
  paintChange: "Tamamı orjinal",
  features: { fuelType: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Gri", engineSize: 1.6 },
};
const itemOf = (input: object, key: string) => listingCompleteness({ ...full, ...input }).items.find((i) => i.key === key)!;

describe("listingCompleteness", () => {
  it("altı konulu uzun açıklamalı, 10 fotoğraflı, tam özellikli ilan 100 alır", () => {
    expect(listingCompleteness(full).score).toBe(100);
  });

  it("hiçbir bilgi yoksa 0 alır", () => {
    expect(listingCompleteness({}).score).toBe(0);
  });

  it("fotoğraf sınırları: 1–2 az, 3–5 zayıf, 6–9 orta, 10+ tam", () => {
    const at = (n: number) => itemOf({ images: photos(n) }, "fotograf").earned;
    expect([at(0), at(1), at(3), at(6), at(9), at(10)]).toEqual([0, 3, 9, 17, 17, 25]);
  });

  it("açıklama uzunluk sınırları (konusuz metin): 40, 150 ve 300 karakterde kademe değişir", () => {
    const at = (n: number) => itemOf({ description: text(n) }, "aciklama").earned;
    expect([at(0), at(1), at(39), at(40), at(149), at(150), at(299), at(300)]).toEqual([0, 1, 1, 3, 3, 7, 7, 12]);
  });

  it("her bilgi konusu 3 puan eder ve Türkçe çekimli kökleri de yakalar", () => {
    // 'bakım' kökü 'bakımları' çekimini kapsar; 'fatura' aynı konuya girer, ikinci konu sayılmaz. Uzunluk 40'ın altında: 1 puan.
    const result = itemOf({ description: "Bakımları tam yapıldı, fatura var." }, "aciklama");
    expect(result.earned).toBe(1 + 3);
    expect(result.note).toContain("Eksik:");
    // Not yalnızca eksik konuları listeler: 'Tek sahipli' kullanım geçmişini karşılar.
    expect(itemOf({ description: "Tek sahipli, garaj." }, "aciklama").note).not.toContain("kullanım");
  });

  it("açıklama yalnız boşluktan oluşuyorsa bilgi sayılmaz", () => {
    expect(itemOf({ description: "     " }, "aciklama").earned).toBe(0);
  });

  it("hasar bilgisi: 'Belirtilmemiş' ve boş metin bilgi değildir; parça listesi, açık hasar kaydı ya da boya metni bilgi sayılır", () => {
    const damage = (input: object) => itemOf({ paintChange: undefined, ...input }, "hasar").earned;
    expect(damage({ paintChange: "Belirtilmemiş" })).toBe(0);
    expect(damage({ paintChange: "" })).toBe(0);
    expect(damage({ damageFlag: false })).toBe(0);
    expect(damage({ damageFlag: true })).toBe(15);
    expect(damage({ damageParts: [{ part: "kapı" }] })).toBe(15);
    expect(damage({ paintChange: "1 boyalı" })).toBe(15);
  });

  it("özellikler: beş alan 6'şar puan; 'Bilinmiyor', 'Belirtilmemiş', 'Doğrulanıyor' ve motor hacmi yoksa eksik sayılır", () => {
    const features = (f: Record<string, unknown>) =>
      itemOf({ features: { fuelType: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Gri", engineSize: 1.6, ...f } }, "ozellikler");
    expect(features({}).earned).toBe(30);
    expect(features({ fuelType: "Bilinmiyor" }).earned).toBe(24);
    expect(features({ bodyType: "Belirtilmemiş" }).earned).toBe(24);
    expect(features({ color: "Doğrulanıyor" }).earned).toBe(24);
    expect(features({ engineSize: null }).earned).toBe(24);
    expect(features({ engineSize: null }).note).toBe("Eksik: Motor hacmi");
    expect(features({ fuelType: "Bilinmiyor" }).note).toBe("Eksik: Yakıt");
  });

  it("motor hacmi yapısal alanda yoksa başlıktan okunur (ör. 'Renault Clio 1.0 TCE')", () => {
    const noStructured = { fuelType: "Benzin", transmission: "Manuel", bodyType: "Hatchback", color: "Gri", engineSize: null };
    expect(itemOf({ title: "Renault Clio 1.0 TCE Evolution", features: noStructured }, "ozellikler").earned).toBe(30);
    expect(itemOf({ title: "Renault Clio Evolution", features: noStructured }, "ozellikler").note).toBe("Eksik: Motor hacmi");
  });

  it("puan dökümü toplamı skoru verir ve her kalem en fazla kendi maksimumunu alır", () => {
    const result = listingCompleteness({ images: photos(3), description: text(90), damageFlag: true, features: { fuelType: "Dizel" } });
    expect(result.items.reduce((sum, i) => sum + i.earned, 0)).toBe(result.score);
    for (const item of result.items) expect(item.earned).toBeLessThanOrEqual(item.max);
    expect(result.items.map((i) => i.max)).toEqual([25, 30, 15, 30]);
    expect(result.score).toBe(9 + 3 + 15 + 6);
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
