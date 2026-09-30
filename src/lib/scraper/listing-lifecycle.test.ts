import { describe, it, expect } from "vitest";
import { LIFECYCLE, breakerTripped, inventoryLooksTrustworthy, shouldArchiveMissing } from "./listing-lifecycle";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-09-30T12:00:00Z");

describe("shouldArchiveMissing", () => {
  it("ilk gözlemde arşivlemez (tek seferlik sayfalama kayması ilanı öldürmemeli)", () => {
    expect(shouldArchiveMissing({}, now)).toBe(false);
    expect(shouldArchiveMissing({ missingSince: null, missingChecks: 0 }, now)).toBe(false);
  });

  it("ikinci gözlem çok yakınsa arşivlemez", () => {
    const since = new Date(now.getTime() - 1 * HOUR);
    expect(shouldArchiveMissing({ missingSince: since, missingChecks: 1 }, now)).toBe(false);
  });

  it("en az iki gözlem ve yeterli süre geçtiyse arşivler", () => {
    const since = new Date(now.getTime() - LIFECYCLE.minMissingSpanMs - HOUR);
    expect(shouldArchiveMissing({ missingSince: since, missingChecks: 1 }, now)).toBe(true);
  });

  it("uzun süre geçse bile tek gözlemle arşivlemez", () => {
    const since = new Date(now.getTime() - 48 * HOUR);
    expect(shouldArchiveMissing({ missingSince: since, missingChecks: 0 }, now)).toBe(false);
  });
});

describe("breakerTripped", () => {
  it("küçük örneklemde tetiklenmez", () => {
    expect(breakerTripped(4, 4)).toBe(false);
  });
  it("partinin büyük kısmı ölü görünüyorsa (engel/site değişikliği) tetiklenir", () => {
    expect(breakerTripped(100, 60)).toBe(true);
    expect(breakerTripped(20, 20)).toBe(true);
  });
  it("normal ölü oranında (%5) tetiklenmez", () => {
    expect(breakerTripped(100, 5)).toBe(false);
    expect(breakerTripped(100, 35)).toBe(false);
  });
  it("aynı partide yeterince canlı sayfa okunduysa yüksek ölü oranına güvenir", () => {
    // Gerçek parti: 50 Otokoç ilanının 31'i veriyle okundu, 19'u satılmış sayfası döndü.
    expect(breakerTripped(50, 19, 31)).toBe(false);
    // Eski stok: 40 ilanın 27'si satılmış, 13'ü canlı.
    expect(breakerTripped(40, 27, 13)).toBe(false);
  });
  it("canlı kanıt azsa yine tetiklenir", () => {
    expect(breakerTripped(50, 48, 2)).toBe(true);
    expect(breakerTripped(100, 80, 10)).toBe(true);
    expect(breakerTripped(20, 20, 0)).toBe(true);
  });
});

describe("inventoryLooksTrustworthy", () => {
  it("hiç ilan bulunamayan taramaya güvenmez", () => {
    expect(inventoryLooksTrustworthy(1000, 0, 1000).ok).toBe(false);
  });
  it("aktif ilanların yarısından azını bulan taramaya güvenmez (Otokoç: DB 1.638, sitede ~1.300 ise tamam)", () => {
    expect(inventoryLooksTrustworthy(1638, 300, 1338).ok).toBe(false);
    expect(inventoryLooksTrustworthy(1638, 1300, 338).ok).toBe(true);
  });
  it("aktiflerin yarısından fazlası kayıp görünüyorsa güvenmez", () => {
    expect(inventoryLooksTrustworthy(100, 60, 60).ok).toBe(false);
  });
  it("çok az aktif ilan varken oran kontrolü uygulanmaz", () => {
    expect(inventoryLooksTrustworthy(5, 3, 3).ok).toBe(true);
  });
});
