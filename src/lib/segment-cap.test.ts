import { describe, expect, it } from "vitest";
import { isAboveSegmentCap, SEGMENT_CAP_RATIO, segmentCapFrom } from "@/lib/segment-cap";

const series = (start: number, n: number) => Array.from({ length: n }, (_, i) => start + i * 1000);

describe("segmentCapFrom", () => {
  it("aile yeterliyse ailenin %95'inin 5 katı tavan olur", () => {
    const cap = segmentCapFrom(series(1_000_000, 30), []);
    expect(cap?.scope).toBe("aile");
    expect(cap?.cap).toBeCloseTo((cap?.reference ?? 0) * SEGMENT_CAP_RATIO);
  });

  it("aile azsa marka geneli referans alınır", () => {
    const cap = segmentCapFrom(series(1_000_000, 5), series(2_000_000, 60));
    expect(cap?.scope).toBe("marka");
  });

  it("iki düzeyde de yeterli veri yoksa tavan uygulanmaz", () => {
    expect(segmentCapFrom(series(1_000_000, 5), series(1_000_000, 10))).toBeNull();
  });
});

describe("isAboveSegmentCap", () => {
  const cap = segmentCapFrom(series(1_400_000, 30), []);

  it("90 milyonluk Doblo'yu engeller", () => {
    expect(isAboveSegmentCap(90_000_000, cap)).toBe(true);
  });

  it("normal fiyatlı ilanı kabul eder", () => {
    expect(isAboveSegmentCap(1_500_000, cap)).toBe(false);
  });

  it("tavan yoksa hiçbir ilanı engellemez", () => {
    expect(isAboveSegmentCap(90_000_000, null)).toBe(false);
  });
});
