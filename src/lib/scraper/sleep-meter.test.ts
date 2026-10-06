import { describe, expect, it } from "vitest";
import { SleepMeter } from "./sleep-meter";

describe("SleepMeter", () => {
  it("zamanında gelen tıkları uyku saymaz", () => {
    let t = 0;
    const meter = new SleepMeter(5_000, 30_000, () => t);
    for (let i = 0; i < 20; i++) {
      t += 5_000;
      meter.tick();
    }
    expect(meter.total()).toBe(0);
  });

  it("küçük gecikmeleri (yoğun işlemci) uyku saymaz", () => {
    let t = 0;
    const meter = new SleepMeter(5_000, 30_000, () => t);
    t += 5_000 + 10_000;
    meter.tick();
    expect(meter.total()).toBe(0);
  });

  it("uykudan sonraki geç tıkı uyku süresi olarak yazar", () => {
    let t = 0;
    const meter = new SleepMeter(5_000, 30_000, () => t);
    t += 5_000;
    meter.tick();
    // 3 saat uyku
    t += 3 * 60 * 60 * 1000;
    meter.tick();
    expect(meter.total()).toBe(3 * 60 * 60 * 1000 - 5_000);
    t += 5_000;
    meter.tick();
    expect(meter.total()).toBe(3 * 60 * 60 * 1000 - 5_000);
  });

  it("birden çok uykuyu toplar", () => {
    let t = 0;
    const meter = new SleepMeter(5_000, 30_000, () => t);
    t += 65_000;
    meter.tick();
    t += 125_000;
    meter.tick();
    expect(meter.total()).toBe(60_000 + 120_000);
  });
});
