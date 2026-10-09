import { describe, expect, it, vi } from "vitest";

const stored: Array<Record<string, unknown>> = [];
vi.mock("@/models/FeatureProbe", () => ({
  FeatureProbe: {
    find: () => ({ lean: async () => stored }),
    updateOne: () => Promise.resolve({}),
  },
}));

import { CHEAP_TTL_MS, isFresh, runGuarded, runProbes, summarize, type ProbeDefinition } from "./feature-probes";

describe("runGuarded", () => {
  it("başarılı sonucu süreyle birlikte verir", async () => {
    const r = await runGuarded(async () => ({ ok: true, detail: "tamam" }), 1000);
    expect(r.ok).toBe(true);
    expect(r.detail).toBe("tamam");
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });

  it("hata fırlatan kontrol kırmızı sonuç olur, çökmez", async () => {
    const r = await runGuarded(async () => {
      throw new Error("veritabanı kapalı");
    }, 1000);
    expect(r).toMatchObject({ ok: false, detail: "veritabanı kapalı" });
  });

  it("zaman aşımında kırmızı olur", async () => {
    const r = await runGuarded(() => new Promise(() => {}), 20);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("yanıt vermedi");
  });
});

describe("isFresh", () => {
  const now = Date.UTC(2026, 9, 9, 12);
  it("süre dolmadıysa taze, dolduysa değil", () => {
    expect(isFresh(new Date(now - 10_000), 10 * 60_000, now)).toBe(true);
    expect(isFresh(new Date(now - 11 * 60_000), 10 * 60_000, now)).toBe(false);
  });
  it("ttl 0 olan kontroller de en az kısa önbelleği kullanır", () => {
    expect(isFresh(new Date(now - 1000), 0, now)).toBe(true);
    expect(isFresh(new Date(now - CHEAP_TTL_MS - 1), 0, now)).toBe(false);
  });
  it("hiç denenmemişse taze değil", () => {
    expect(isFresh(null, 1000, now)).toBe(false);
  });
});

describe("summarize", () => {
  it("bilgi amaçlı kontroller arıza sayılmaz", () => {
    expect(summarize([{ ok: true, informational: false }, { ok: false, informational: true }])).toEqual({ total: 1, failing: 0, allOk: true });
    expect(summarize([{ ok: false, informational: false }, { ok: true, informational: false }])).toEqual({ total: 2, failing: 1, allOk: false });
  });
});

describe("runProbes", () => {
  const make = (key: string, run: ProbeDefinition["run"]): ProbeDefinition => ({ key, label: key, group: "Site özellikleri", ttlMs: 0, run });

  it("bir kontrol bozulsa da diğerleri sonuç verir", async () => {
    const results = await runProbes({
      force: true,
      probes: [
        make("iyi", async () => ({ ok: true, detail: "çalışıyor" })),
        make("bozuk", async () => {
          throw new Error("beklenmeyen hata");
        }),
        make("zayif", async () => ({ ok: false, detail: "eksik" })),
      ],
    });
    expect(results.map((r) => [r.key, r.ok])).toEqual([
      ["iyi", true],
      ["bozuk", false],
      ["zayif", false],
    ]);
    expect(results[1].detail).toBe("beklenmeyen hata");
  });

  it("süresi dolmamış son sonucu yeniden çalıştırmadan verir", async () => {
    const now = Date.UTC(2026, 9, 9, 12);
    stored.push({ key: "agir", ok: true, detail: "eski ama taze", ms: 5, checkedAt: new Date(now - 60_000), lastOkAt: new Date(now - 60_000) });
    const run = vi.fn(async () => ({ ok: false, detail: "çalıştı" }));
    const results = await runProbes({ now, probes: [{ ...make("agir", run), ttlMs: 10 * 60_000 }] });
    expect(run).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({ ok: true, detail: "eski ama taze" });
  });
});
