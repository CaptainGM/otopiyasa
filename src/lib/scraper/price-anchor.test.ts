import { describe, expect, it } from "vitest";
import { isAcceptableScrapedPrice } from "./price-guard";

describe("isAcceptableScrapedPrice", () => {
  it("normal bir değişim güncel fiyata göre kabul edilir", () => {
    expect(isAcceptableScrapedPrice(2_250_000, 2_500_000, 2_200_000)).toBe(true);
  });

  it("yanlış düşük değer (ör. 152.026 TL) reddedilir", () => {
    expect(isAcceptableScrapedPrice(2_250_000, 2_500_000, 152_026)).toBe(false);
  });

  it("yanlış düşük güncel fiyat, ilk (doğru) fiyata dönüşle düzelir", () => {
    expect(isAcceptableScrapedPrice(152_026, 2_750_000, 2_250_000)).toBe(true);
  });

  it("birleşik (devasa) değer, ilk fiyat yakın olsa bile reddedilir", () => {
    expect(isAcceptableScrapedPrice(885_999, 905_999, 905_999_885_999)).toBe(false);
  });

  it("ilk fiyat yoksa yalnız güncel fiyata bakılır; güncel fiyat da yoksa her değer kabul edilir", () => {
    expect(isAcceptableScrapedPrice(2_250_000, undefined, 152_026)).toBe(false);
    expect(isAcceptableScrapedPrice(undefined, undefined, 500_000)).toBe(true);
  });
});
