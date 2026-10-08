import { describe, expect, it } from "vitest";
import { PACING, planNextStep, discoveryShare, ChangeWindow } from "./arabam-pacing";

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
    expect(slow.gapSeconds).toBeCloseTo(13, 5);
    expect(slow.sleepMinutes).toBe(0);

    let state = { gapSeconds: slow.gapSeconds, pauseMinutes: slow.pauseMinutes };
    for (let i = 0; i < 10; i++) {
      const next = planNextStep(state, { checked: 20, blocked: 0, errors: 0, paused: false });
      state = { gapSeconds: next.gapSeconds, pauseMinutes: next.pauseMinutes };
    }
    expect(state.gapSeconds).toBe(PACING.baseGapSeconds);
  });

  it("art arda engelde uzun mola verir ve molayı her seferinde ikiye katlar", () => {
    const first = planNextStep(start, { checked: 6, blocked: 4, errors: 0, paused: true });
    expect(first.reason).toBe("blocked-pause");
    expect(first.sleepMinutes).toBe(PACING.firstPauseMinutes);

    const second = planNextStep(first, { checked: 4, blocked: 4, errors: 0, paused: true });
    expect(second.sleepMinutes).toBe(PACING.firstPauseMinutes * 2);

    let plan = second;
    for (let i = 0; i < 6; i++) plan = planNextStep(plan, { checked: 4, blocked: 4, errors: 0, paused: true });
    expect(plan.sleepMinutes).toBe(PACING.maxPauseMinutes);
    expect(plan.gapSeconds).toBeLessThanOrEqual(PACING.maxGapSeconds);
  });

  it("partinin dörtte biri engelse sınıra gelmese de mola verir", () => {
    const plan = planNextStep(start, { checked: 20, blocked: 6, errors: 0, paused: false });
    expect(plan.reason).toBe("blocked-pause");
  });

  it("engel gitince mola sıfırlanır", () => {
    const afterPause = planNextStep({ gapSeconds: 15, pauseMinutes: 30 }, { checked: 20, blocked: 0, errors: 0, paused: false });
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
    // 1000 kontrolden yalnızca son ~400'ü kalır: ilk %50'lik parti pencereden düşmüştür.
    expect(w.rate()).toBe(0);
  });
});
