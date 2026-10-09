import { describe, expect, it } from "vitest";
import { describeChange, describeQueueMix, formatVerifyLine, titleFromHref } from "./verify-line";

const time = new Date("2026-10-09T17:47:40Z");

describe("describeChange", () => {
  it("fiyat ve kilometre değişimini yazar, fiyat düşüşünde eksi işareti kullanır", () => {
    expect(describeChange({ priceFrom: 1_250_000, priceTo: 1_230_000, mileageFrom: 85_000, mileageTo: 86_200 })).toBe(
      "fiyat 1.250.000 → 1.230.000 TL (−20.000) · km 85.000 → 86.200"
    );
    expect(describeChange({ priceFrom: 500_000, priceTo: 520_000 })).toContain("(+20.000)");
  });

  it("değişmeyen ya da verilmeyen alanı yazmaz", () => {
    expect(describeChange(undefined)).toBe("");
    expect(describeChange({ priceFrom: 100, priceTo: 100 })).toBe("");
    expect(describeChange({ descChanged: true, damageChanged: true })).toBe("açıklama değişti · hasar bilgisi değişti");
  });
});

describe("titleFromHref", () => {
  it("ilan adresinden okunur ad çıkarır", () => {
    expect(titleFromHref("/ilan/galeriden-satilik-fiat-egea-1-4-easy/baslik/123")).toBe("fiat egea 1 4 easy");
    expect(titleFromHref("/ilan/sahibinden-satilik-bmw-3-serisi/x/9")).toBe("bmw 3 serisi");
  });
});

describe("formatVerifyLine", () => {
  it("canlı ve değişiklik yok", () => {
    expect(formatVerifyLine({ kind: "alive", title: "Fiat Egea 2019", time })).toContain("✓ canlı · değişiklik yok · Fiat Egea 2019");
  });

  it("canlı ve değişen bilgiyi gösterir", () => {
    const line = formatVerifyLine({ kind: "changed", title: "BMW 320i", detail: { priceFrom: 2_000_000, priceTo: 1_900_000 }, time });
    expect(line).toContain("✓ canlı · fiyat 2.000.000 → 1.900.000 TL (−100.000) · BMW 320i");
  });

  it("kaldırılmış, engelli, geri açılan ve okunamayan ilanı ayrı yazar", () => {
    expect(formatVerifyLine({ kind: "gone", title: "x", time })).toContain("🗑 kaynakta yok");
    expect(formatVerifyLine({ kind: "blocked", title: "x", time })).toContain("⛔ okunamadı (engel");
    expect(formatVerifyLine({ kind: "reactivated", title: "x", time })).toContain("↩ arşivden geri açıldı");
    expect(formatVerifyLine({ kind: "unparsed", title: "x", time })).toContain("sayfa açıldı ama okunamadı");
  });

  it("uzun başlığı kısaltır", () => {
    expect(formatVerifyLine({ kind: "alive", title: "a".repeat(100), time })).toContain(`${"a".repeat(57)}...`);
  });
});

describe("describeQueueMix", () => {
  it("partinin içeriğini yazar, boşsa 'boş' der", () => {
    expect(describeQueueMix({ never: 187, stale: 0, missing: 0, recheck: 63 })).toBe("187 hiç doğrulanmamış, 63 arşivdeki ilanın yeniden kontrolü");
    expect(describeQueueMix({ never: 0, stale: 0, missing: 0, recheck: 0 })).toBe("boş");
  });
});
