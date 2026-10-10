import { describe, expect, it } from "vitest";
import { marketPosition } from "./market-position";
import { FAIR_BAND_PCT, MIN_MARKET_COMPARABLES, SUSPICIOUS_PCT } from "./market-thresholds";

describe("marketPosition", () => {
  it("eşikler mobil kopyayla aynı kalmalı", () => {
    // mobile/lib/utils/market_position.dart içindeki fairBandPct / suspiciousPct /
    // minMarketComparables ile birebir aynı olmalı; biri değişirse iki istemci farklı
    // renk/etiket gösterir. Değerler kasten burada sabitlenmiştir.
    expect(FAIR_BAND_PCT).toBe(6);
    expect(SUSPICIOUS_PCT).toBe(30);
    expect(MIN_MARKET_COMPARABLES).toBe(3);
  });
  it("emsal yetersizse gösterge yok", () => {
    expect(marketPosition(1_000_000, 1_000_000, 2)).toBeNull();
    expect(marketPosition(1_000_000, 0, 10)).toBeNull();
    expect(marketPosition(1_000_000, undefined, undefined)).toBeNull();
  });

  it("±%6 içi piyasa değerinde, ibre ortada", () => {
    const p = marketPosition(1_040_000, 1_000_000, 8)!;
    expect(p.band).toBe("fair");
    expect(p.pct).toBe(4);
    expect(p.marker).toBe(60);
  });

  it("ucuz, pahalı ve şüpheli ucuz", () => {
    expect(marketPosition(880_000, 1_000_000, 5)).toMatchObject({ band: "cheap", label: "%12 ucuz" });
    expect(marketPosition(1_150_000, 1_000_000, 5)).toMatchObject({ band: "pricey", label: "%15 pahalı" });
    expect(marketPosition(650_000, 1_000_000, 5)).toMatchObject({ band: "suspicious", label: "Şüpheli ucuz" });
  });

  it("ibre uçlarda taşmaz", () => {
    expect(marketPosition(100_000, 1_000_000, 5)!.marker).toBe(6);
    expect(marketPosition(3_000_000, 1_000_000, 5)!.marker).toBe(94);
  });
});
