import { describe, it, expect } from "vitest";
import { shouldNotifySegmentAlert, MIN_SEGMENT_SAMPLES, SEGMENT_ALERT_COOLDOWN_MS } from "./segment-alert";

describe("shouldNotifySegmentAlert", () => {
  it("eşiğin üzerindeyse bildirmez", () => {
    expect(
      shouldNotifySegmentAlert({
        currentAvgPrice: 1_200_000,
        targetAvgPrice: 1_000_000,
        sampleCount: 10,
        lastNotifiedAt: null,
      })
    ).toBe(false);
  });

  it("örnek sayısı yetersizse bildirmez", () => {
    expect(
      shouldNotifySegmentAlert({
        currentAvgPrice: 900_000,
        targetAvgPrice: 1_000_000,
        sampleCount: MIN_SEGMENT_SAMPLES - 1,
        lastNotifiedAt: null,
      })
    ).toBe(false);
  });

  it("veri yoksa (null ortalama) bildirmez", () => {
    expect(
      shouldNotifySegmentAlert({
        currentAvgPrice: null,
        targetAvgPrice: 1_000_000,
        sampleCount: 10,
        lastNotifiedAt: null,
      })
    ).toBe(false);
  });

  it("eşiğin altında ve daha önce hiç bildirilmemişse bildirir", () => {
    expect(
      shouldNotifySegmentAlert({
        currentAvgPrice: 950_000,
        targetAvgPrice: 1_000_000,
        sampleCount: 5,
        lastNotifiedAt: null,
      })
    ).toBe(true);
  });

  it("soğuma süresi dolmadıysa tekrar bildirmez", () => {
    const now = new Date("2026-08-10T00:00:00Z");
    const lastNotifiedAt = new Date(now.getTime() - SEGMENT_ALERT_COOLDOWN_MS / 2);
    expect(
      shouldNotifySegmentAlert({
        currentAvgPrice: 900_000,
        targetAvgPrice: 1_000_000,
        sampleCount: 5,
        lastNotifiedAt,
        now,
      })
    ).toBe(false);
  });

  it("soğuma süresi dolduysa tekrar bildirir", () => {
    const now = new Date("2026-08-10T00:00:00Z");
    const lastNotifiedAt = new Date(now.getTime() - SEGMENT_ALERT_COOLDOWN_MS - 1000);
    expect(
      shouldNotifySegmentAlert({
        currentAvgPrice: 900_000,
        targetAvgPrice: 1_000_000,
        sampleCount: 5,
        lastNotifiedAt,
        now,
      })
    ).toBe(true);
  });
});
