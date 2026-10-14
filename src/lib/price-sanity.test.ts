import { describe, expect, it } from "vitest";
import { judgePrice, sanityMessage, SANITY_HIGH_RATIO, SANITY_LOW_RATIO } from "./price-sanity";

const family = [2_200_000, 2_250_000, 2_300_000, 2_280_000, 2_260_000, 2_240_000];

describe("judgePrice", () => {
  it("normal fiyat ok sayılır", () => {
    expect(judgePrice(2_400_000, family).status).toBe("ok");
  });

  it("orta değerin dörtte birinden düşük fiyat low (yanlış tutar, ör. 152.026 TL)", () => {
    const verdict = judgePrice(152_026, family);
    expect(verdict.status).toBe("low");
    expect(verdict.median).toBeCloseTo(2_255_000);
  });

  it("orta değerin üç katından yüksek fiyat high (ör. 15,75 milyon)", () => {
    expect(judgePrice(15_750_000, family).status).toBe("high");
  });

  it("eşikler tam sınırda: düşük sınır dahil değil, yüksek sınır dahil değil", () => {
    const mid = 2_255_000;
    expect(judgePrice(mid * SANITY_LOW_RATIO, family).status).toBe("ok");
    expect(judgePrice(mid * SANITY_HIGH_RATIO, family).status).toBe("ok");
  });

  it("beşten az emsalde denetim yapılmaz; geçersiz emsaller sayılmaz", () => {
    expect(judgePrice(10_000, [2_000_000, 2_100_000, 2_200_000, 0, -5]).status).toBe("insufficient");
    expect(judgePrice(0, family).status).toBe("insufficient");
  });
});

describe("sanityMessage", () => {
  it("düşük ve yüksek fiyatlar için Türkçe mesaj üretir; normal fiyat için mesaj yok", () => {
    expect(sanityMessage(152_026, judgePrice(152_026, family))).toContain("%25'inden düşük");
    expect(sanityMessage(15_750_000, judgePrice(15_750_000, family))).toContain("3 katından yüksek");
    expect(sanityMessage(2_400_000, judgePrice(2_400_000, family))).toBeNull();
    expect(sanityMessage(10_000, judgePrice(10_000, [1_000_000]))).toBeNull();
  });
});
