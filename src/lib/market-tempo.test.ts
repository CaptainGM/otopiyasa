import { describe, expect, it } from "vitest";
import { daysOnMarket, parseTrDate, priceDropPct, summarizeTempo, TEMPO_MIN_DAYS_SAMPLE } from "./market-tempo";

const d = (iso: string) => new Date(iso);

describe("parseTrDate", () => {
  it("kaynağın Türkçe ilan tarihini okur", () => {
    expect(parseTrDate("19 Eylül 2026")?.toISOString()).toBe("2026-09-18T21:00:00.000Z");
    expect(parseTrDate("1 Ağustos 2026")?.toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(parseTrDate("bilinmiyor")).toBeNull();
  });
});

describe("daysOnMarket", () => {
  it("son canlı görülme ile arşiv anının ortasını kaldırılma anı sayar", () => {
    const days = daysOnMarket({
      listingDate: "1 Ekim 2026",
      lastVerifiedAt: d("2026-10-09T21:00:00Z"),
      removedAt: d("2026-10-11T21:00:00Z"),
    });
    expect(days).toBe(10); // 30 Eyl 21:00 → 10 Eki 21:00
  });

  it("ilan tarihi yoksa ilk görüldüğü anı kullanır, geçersiz süreyi atar", () => {
    expect(daysOnMarket({ createdAt: d("2026-10-01T00:00:00Z"), removedAt: d("2026-10-06T00:00:00Z") })).toBe(5);
    expect(daysOnMarket({ createdAt: d("2026-10-06T00:00:00Z"), removedAt: d("2026-10-01T00:00:00Z") })).toBeNull();
    expect(daysOnMarket({ createdAt: d("2026-10-01T00:00:00Z") })).toBeNull();
  });
});

describe("priceDropPct", () => {
  it("ilk fiyattan bugüne indirimi verir; aynı fiyat tekrarı ve hatalı fiyat düzeltmesi indirim sayılmaz", () => {
    expect(priceDropPct({ price: 950_000, priceHistory: [{ price: 1_000_000 }, { price: 950_000 }] })).toBe(5);
    expect(priceDropPct({ price: 1_000_000, priceHistory: [{ price: 1_000_000 }, { price: 1_000_000 }] })).toBe(0);
    expect(priceDropPct({ price: 100_000, priceHistory: [{ price: 1_000_000 }, { price: 100_000 }] })).toBe(0);
    expect(priceDropPct({ price: 1_000_000, priceHistory: [{ price: 1_000_000 }] })).toBeNull();
  });
});

describe("summarizeTempo", () => {
  it("örnek azsa sonuç uydurmaz", () => {
    const few = Array.from({ length: TEMPO_MIN_DAYS_SAMPLE - 1 }, () => ({ createdAt: d("2026-10-01T00:00:00Z"), removedAt: d("2026-10-11T00:00:00Z") }));
    expect(summarizeTempo(few, [], "x").days).toBeNull();
  });

  it("ortanca süre ve indirim oranını hesaplar", () => {
    const removed = Array.from({ length: 20 }, (_, i) => ({ createdAt: d("2026-09-01T00:00:00Z"), removedAt: new Date(Date.UTC(2026, 8, 1 + (i + 1))) }));
    const withHistory = Array.from({ length: 20 }, (_, i) => ({
      price: i < 5 ? 900_000 : 1_000_000,
      priceHistory: [{ price: 1_000_000 }, { price: i < 5 ? 900_000 : 1_000_000 }],
    }));
    const tempo = summarizeTempo(removed, withHistory, "Fiat Egea");
    expect(tempo.days).toMatchObject({ median: 11, sample: 20 });
    expect(tempo.drop).toEqual({ share: 25, medianPct: 10, sample: 20 });
  });
});
