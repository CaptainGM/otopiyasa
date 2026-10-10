import { describe, expect, it } from "vitest";
import { marketPosition } from "./market-position";
import { ABSURD_PRICE_PCT, FAIR_BAND_PCT, MIN_MARKET_COMPARABLES, SUSPICIOUS_PCT } from "./market-thresholds";

describe("marketPosition", () => {
  it("eşikler mobil kopyayla aynı kalmalı", () => {
    // mobile/lib/utils/market_position.dart içindeki fairBandPct / suspiciousPct /
    // minMarketComparables / absurdPricePct ile birebir aynı olmalı; biri değişirse iki istemci
    // farklı renk/etiket gösterir. Değerler kasten burada sabitlenmiştir.
    expect(FAIR_BAND_PCT).toBe(6);
    expect(SUSPICIOUS_PCT).toBe(30);
    expect(MIN_MARKET_COMPARABLES).toBe(3);
    expect(ABSURD_PRICE_PCT).toBe(400);
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

  it("ortalamanın kat be kat üstündeki fiyat yüzde yerine veri hatası olarak işaretlenir", () => {
    // Canlıda görülen gerçek vaka: 1990 Renault R 9, 105.000.000 TL, segment ortalaması ~141.000 TL.
    // Eskiden kartta "%74453 PAHALI" yazıyordu; matematik doğru ama gösterim anlamsız.
    const absurd = marketPosition(105_000_000, 141_000, 86)!;
    expect(absurd.band).toBe("invalid");
    expect(absurd.label).toBe("Piyasa dışı fiyat");
    expect(absurd.label).not.toContain("%");
  });

  it("sınır: 5 katı geçen veri hatası, geçmeyen normal 'pahalı'", () => {
    // yüzde Math.round ile tamsayıya çevrildiği için sınır testi yuvarlamanın belirsiz olmadığı
    // değerlerle yapılır: 6 kat (+%500) kesin veri hatası, 4 kat (+%300) kesin normal "pahalı".
    expect(marketPosition(4 * 1_000_000, 1_000_000, 5)!.band).toBe("pricey");
    expect(marketPosition(6 * 1_000_000, 1_000_000, 5)!.band).toBe("invalid");
  });
});
