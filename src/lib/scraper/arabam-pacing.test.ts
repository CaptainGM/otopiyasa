import { describe, expect, it } from "vitest";
import { PACING, planNextStep, discoveryShare, ChangeWindow, getArabamPacingConfig } from "./arabam-pacing";

const start = { gapSeconds: PACING.baseGapSeconds, pauseMinutes: 0 };

describe("planNextStep", () => {
  it("sırada ilan yoksa bekler, hızı değiştirmez", () => {
    const plan = planNextStep(start, { checked: 0, blocked: 0, errors: 0, paused: false });
    expect(plan.reason).toBe("idle");
    expect(plan.sleepMinutes).toBe(PACING.idleMinutes);
    expect(plan.gapSeconds).toBe(start.gapSeconds);
  });

  it("temiz partide hemen devam eder, hız temel değerin altına inmez", () => {
    const plan = planNextStep(start, { checked: 20, blocked: 0, errors: 1, paused: false });
    expect(plan.reason).toBe("ok");
    expect(plan.sleepMinutes).toBe(0);
    expect(plan.gapSeconds).toBe(PACING.baseGapSeconds);
  });

  it("engelden sonra yavaşlar, temiz partilerle yavaş yavaş eski hıza döner", () => {
    const slow = planNextStep(start, { checked: 20, blocked: 1, errors: 0, paused: false });
    expect(slow.reason).toBe("slow-down");
    expect(slow.gapSeconds).toBeCloseTo(Math.round(PACING.baseGapSeconds * 1.2 * 10) / 10, 5);
    expect(slow.sleepMinutes).toBe(0);

    let state = { gapSeconds: slow.gapSeconds, pauseMinutes: slow.pauseMinutes };
    for (let i = 0; i < 10; i++) {
      const next = planNextStep(state, { checked: 20, blocked: 0, errors: 0, paused: false });
      state = { gapSeconds: next.gapSeconds, pauseMinutes: next.pauseMinutes };
    }
    expect(state.gapSeconds).toBe(PACING.baseGapSeconds);
  });

  it("art arda engelde 20-25 dk mola verir ve 25 dk sınırını aşmaz", () => {
    const first = planNextStep(start, { checked: 6, blocked: 4, errors: 0, paused: true });
    expect(first.reason).toBe("blocked-pause");
    expect(first.sleepMinutes).toBe(PACING.firstPauseMinutes);
    expect(first.sleepMinutes).toBe(20);

    const second = planNextStep(first, { checked: 4, blocked: 4, errors: 0, paused: true });
    expect(second.sleepMinutes).toBe(PACING.maxPauseMinutes);
    expect(second.sleepMinutes).toBe(25);

    let plan = second;
    for (let i = 0; i < 6; i++) plan = planNextStep(plan, { checked: 4, blocked: 4, errors: 0, paused: true });
    expect(plan.sleepMinutes).toBe(PACING.maxPauseMinutes);
    expect(plan.sleepMinutes).toBe(25);
    expect(plan.gapSeconds).toBeLessThanOrEqual(PACING.maxGapSeconds);
  });

  it("partinin dörtte biri engelse sınıra gelmese de mola verir", () => {
    const plan = planNextStep(start, { checked: 20, blocked: 6, errors: 0, paused: false });
    expect(plan.reason).toBe("blocked-pause");
    expect(plan.sleepMinutes).toBe(20);
  });

  it("engel gitince mola sıfırlanır", () => {
    const afterPause = planNextStep({ gapSeconds: 15, pauseMinutes: 20 }, { checked: 20, blocked: 0, errors: 0, paused: false });
    expect(afterPause.pauseMinutes).toBe(0);
    expect(afterPause.sleepMinutes).toBe(0);
  });

  it("parti çoğunlukla hata verdiyse (internet yok gibi) kısa bekler, hızı bozmaz", () => {
    const plan = planNextStep(start, { checked: 20, blocked: 0, errors: 18, paused: false });
    expect(plan.reason).toBe("errors");
    expect(plan.sleepMinutes).toBe(PACING.errorMinutes);
    expect(plan.gapSeconds).toBe(start.gapSeconds);
  });
});

describe("getArabamPacingConfig & hafta içi / sonu ayrımı", () => {
  it("hafta sonu aralığı Cloudflare sıkı olduğundan temkinli: 10-14 sn (taban 12 sn)", () => {
    const sat = new Date("2026-10-31T12:00:00Z");
    const cfg = getArabamPacingConfig(sat);
    expect(cfg.isWeekend).toBe(true);
    expect(cfg.baseGapSeconds).toBe(12);
    expect(cfg.minMs).toBe(10000);
    expect(cfg.spreadMs).toBe(4000);
  });

  it("hafta içi aralığı daha akıcı: 8-11.5 sn (taban 9 sn)", () => {
    const wed = new Date("2026-10-28T12:00:00Z");
    const cfg = getArabamPacingConfig(wed);
    expect(cfg.isWeekend).toBe(false);
    expect(cfg.baseGapSeconds).toBe(9);
    expect(cfg.minMs).toBe(8000);
    expect(cfg.spreadMs).toBe(3500);
  });
});

describe("discoveryShare / ChangeWindow", () => {
  it("kontrol verimliyken varsayılan %10 kalır", () => {
    expect(discoveryShare(0.27)).toBe(0.1);
    expect(discoveryShare(0.08)).toBe(0.1);
  });

  it("neredeyse hiçbir ilan değişmiyorsa %50'ye çıkar, arası doğrusaldır", () => {
    expect(discoveryShare(0.01)).toBe(0.5);
    expect(discoveryShare(0)).toBe(0.5);
    expect(discoveryShare(0.045)).toBeCloseTo(0.3, 2);
  });

  it("yeterli veri yoksa (null) varsayılan pay", () => {
    expect(discoveryShare(null)).toBe(0.1);
    expect(discoveryShare(NaN)).toBe(0.1);
  });

  it("kayan pencere az veride oran vermez, çok veride eski partileri atar", () => {
    const w = new ChangeWindow(400, 150);
    w.add(100, 50);
    expect(w.rate()).toBeNull();
    w.add(100, 0);
    expect(w.rate()).toBeCloseTo(0.25, 5);
    for (let i = 0; i < 8; i++) w.add(100, 0);
    expect(w.rate()).toBe(0);
  });
});
