import { describe, expect, it } from "vitest";
import type { PriceScale, PriceScaleTier } from "@/lib/price-scale";
import {
  chooseSellEstimate,
  damageToFields,
  parseEngineSize,
  parseListingDamage,
  parseSellDamage,
  parseSellSubject,
  priceGuard,
  storedDamage,
  yearMileageWarnings,
  type SellEstimate,
} from "./sell-estimate";

function tier(key: string, n: number, p25: number, median: number, p75: number, usable = true): PriceScaleTier {
  return {
    key,
    label: key,
    n,
    minN: 5,
    usable,
    note: null,
    missingPackage: false,
    min: p25,
    p25,
    median,
    p75,
    max: p75,
    mean: median,
    cheaperPct: 50,
    medianDiffPct: 0,
  } as PriceScaleTier;
}

function scaleOf(tiers: PriceScaleTier[]): PriceScale {
  return { listingPrice: 0, packageKnown: true, inferredEngine: null, tiers, chosen: null, sample: [] } as PriceScale;
}

const confidentEstimate: SellEstimate = {
  confident: true,
  reason: "",
  tier: { key: "donanim", label: "donanim", n: 20, p25: 900_000, median: 1_000_000, p75: 1_100_000 },
};

describe("chooseSellEstimate", () => {
  it("10 ve üzeri emsalli dar kademeyi seçer", () => {
    const result = chooseSellEstimate(scaleOf([tier("tam", 4, 1, 2, 3), tier("donanim", 12, 900, 1000, 1100), tier("km", 30, 800, 1000, 1200)]));
    expect(result.confident).toBe(true);
    expect(result.tier?.key).toBe("donanim");
  });

  it("aile kademesi satıcıya kullanılmaz", () => {
    expect(chooseSellEstimate(scaleOf([tier("aile", 50, 900, 1000, 1100)])).confident).toBe(false);
  });

  it("emsal 10'un altındaysa gösterilmez", () => {
    expect(chooseSellEstimate(scaleOf([tier("km", 9, 900, 1000, 1100)])).confident).toBe(false);
  });

  it("kademe dağınıksa gösterilmez ve daha geniş kademeye düşmez", () => {
    const result = chooseSellEstimate(scaleOf([tier("donanim", 15, 500, 1000, 1500), tier("km", 40, 900, 1000, 1100)]));
    expect(result.confident).toBe(false);
    expect(result.reason).toContain("dağınık");
  });
});

describe("priceGuard", () => {
  it("orta değerin 2,5 katı ve üzeri her zaman engellenir (mesaj Türkçe ondalık kullanır)", () => {
    const high = priceGuard(2_500_000, confidentEstimate, { damageKnown: false });
    expect(high.level).toBe("block");
    expect(high.message).toContain("2,5 katından");
    expect(priceGuard(10_000_000, confidentEstimate, { damageKnown: true }).level).toBe("block");
  });

  it("düşük uç yalnızca hasar durumu bildirildiyse engellenir", () => {
    expect(priceGuard(400_000, confidentEstimate, { damageKnown: true }).level).toBe("block");
    expect(priceGuard(400_000, confidentEstimate, { damageKnown: false }).level).not.toBe("block");
  });

  it("aralığın %20 dışı yalnızca uyarıdır; aralık içi sessizdir", () => {
    expect(priceGuard(700_000, confidentEstimate, { damageKnown: true }).level).toBe("warn");
    expect(priceGuard(1_000_000, confidentEstimate, { damageKnown: true }).level).toBe("none");
  });

  it("güvenilir aralık yoksa ya da fiyat boşsa hiçbir şey yapmaz", () => {
    const none: SellEstimate = { confident: false, reason: "x", tier: null };
    expect(priceGuard(9_999_999_999, none, { damageKnown: true }).level).toBe("none");
    expect(priceGuard(0, confidentEstimate, { damageKnown: true }).level).toBe("none");
  });
});

describe("hasar durumu", () => {
  it("form seçimi ilan alanlarına doğru çevrilir", () => {
    expect(damageToFields("orijinal")).toEqual({ damageFlag: false, paintChange: "Tamamı orjinal" });
    expect(damageToFields("boyali")).toEqual({ damageFlag: false, paintChange: "Boyalı veya değişen parça var" });
    expect(damageToFields("hasarli")).toEqual({ damageFlag: true, paintChange: "" });
  });

  it("kayıtlı ilandan hasar durumu geri okunur; bilinmeyen ilan null döner", () => {
    expect(storedDamage({ damageFlag: true, paintChange: "" })).toBe("hasarli");
    expect(storedDamage({ damageFlag: false, paintChange: "Tamamı orjinal" })).toBe("orijinal");
    expect(storedDamage({ damageFlag: false, paintChange: "Boyalı veya değişen parça var" })).toBe("boyali");
    expect(storedDamage({ damageFlag: false, paintChange: "" })).toBeNull();
  });

  it("geçersiz değer reddedilir, boş değer 'bilinmiyor' sayılır", () => {
    expect(parseSellDamage("hasarli")).toBe("hasarli");
    expect(parseSellDamage("bilinmiyor")).toBeNull();
    expect(parseListingDamage(undefined)).toEqual({ ok: true, value: null });
    expect(parseListingDamage("")).toEqual({ ok: true, value: null });
    expect(parseListingDamage("cok-hasarli").ok).toBe(false);
  });
});

describe("parseEngineSize", () => {
  it("virgül ya da nokta kabul eder, boşsa null", () => {
    expect(parseEngineSize("1,6")).toEqual({ ok: true, value: 1.6 });
    expect(parseEngineSize("2.0")).toEqual({ ok: true, value: 2 });
    expect(parseEngineSize("")).toEqual({ ok: true, value: null });
  });

  it("aralık dışını ve sayı olmayanı reddeder", () => {
    expect(parseEngineSize("0,5").ok).toBe(false);
    expect(parseEngineSize("8,1").ok).toBe(false);
    expect(parseEngineSize("1.6.2").ok).toBe(false);
  });
});

describe("parseSellSubject", () => {
  const valid = {
    brand: " Volkswagen ",
    model: "Golf",
    year: 2018,
    mileage: 120000,
    fuelType: "Dizel",
    transmission: "Manuel",
    engineSize: "1,6",
    damage: "orijinal",
  };

  it("geçerli girdiyi normalleştirir", () => {
    const result = parseSellSubject(valid, 2026);
    expect(result).toEqual({
      ok: true,
      value: {
        brand: "Volkswagen",
        model: "Golf",
        year: 2018,
        mileage: 120000,
        fuelType: "Dizel",
        transmission: "Manuel",
        engineSize: 1.6,
        damage: "orijinal",
        excludeId: null,
      },
    });
  });

  it("elektrikli araçta motor hacmini yok sayar, düzenlenen ilanın kimliğini korur", () => {
    const result = parseSellSubject({ ...valid, fuelType: "Elektrik", excludeId: "6a60ec996701548eb7a8ad27" }, 2026);
    expect(result.ok && result.value.engineSize).toBe(null);
    expect(result.ok && result.value.excludeId).toBe("6a60ec996701548eb7a8ad27");
  });

  it("eksik ya da geçersiz alanda hata döner", () => {
    expect(parseSellSubject({ ...valid, transmission: "Bilinmiyor" }, 2026).ok).toBe(false);
    expect(parseSellSubject({ ...valid, damage: "cok" }, 2026).ok).toBe(false);
    expect(parseSellSubject({ ...valid, year: 2040 }, 2026).ok).toBe(false);
    expect(parseSellSubject({ ...valid, model: "" }, 2026).ok).toBe(false);
  });
});

describe("yearMileageWarnings", () => {
  it("bariz tutarsızlıkları uyarır, makul girişi sessiz geçer", () => {
    const now = 2026;
    expect(yearMileageWarnings(2026, 500, now)).toEqual([]);
    expect(yearMileageWarnings(2012, 400_000, now).some((w) => w.includes("çok yüksek"))).toBe(false);
    expect(yearMileageWarnings(2026, 600_000, now).some((w) => w.includes("çok yüksek"))).toBe(true);
    expect(yearMileageWarnings(2020, 500, now).some((w) => w.includes("çok düşük"))).toBe(true);
    expect(yearMileageWarnings(2030, 1000, now).some((w) => w.includes("gelecekte"))).toBe(true);
  });
});
