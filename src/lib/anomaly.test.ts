import { describe, expect, it } from "vitest";
import { detectPriceAnomaly } from "@/lib/anomaly";

describe("detectPriceAnomaly", () => {
  const segment = [900_000, 950_000, 1_000_000, 1_050_000, 1_100_000];

  it("aşırı ucuz ilanı işaretler", () => {
    const result = detectPriceAnomaly(700_000, segment);
    expect(result?.label).toBe("ucuz");
    expect(result!.z).toBeLessThan(-1.5);
    expect(result!.pctFromMean).toBeLessThan(0);
  });

  it("aşırı pahalı ilanı işaretler", () => {
    const result = detectPriceAnomaly(1_400_000, segment);
    expect(result?.label).toBe("pahali");
  });

  it("normal fiyatı işaretlemez ama z değerini döner", () => {
    const result = detectPriceAnomaly(1_000_000, segment);
    expect(result?.label).toBeNull();
    expect(result?.z).toBe(0);
    expect(result?.sampleCount).toBe(5);
  });

  it("yetersiz emsalde null döner", () => {
    expect(detectPriceAnomaly(500_000, [900_000, 950_000])).toBeNull();
  });

  it("tüm emsaller aynı fiyatsa null döner (std=0)", () => {
    expect(detectPriceAnomaly(500_000, Array(6).fill(1_000_000))).toBeNull();
  });
});
