import { describe, expect, it } from "vitest";
import { buildDailySummary, daemonBySource, emptyDelta, manualBySource, turkeyDayStart, watcherDelta } from "@/lib/daily-summary";

describe("turkeyDayStart", () => {
  it("Türkiye gününün başlangıcını (UTC+3) verir", () => {
    expect(turkeyDayStart(new Date("2026-10-08T15:30:00Z")).toISOString()).toBe("2026-10-07T21:00:00.000Z");
  });

  it("gece yarısını geçince yeni güne geçer", () => {
    // 21:30 UTC = 00:30 Türkiye saati, 9 Ekim
    expect(turkeyDayStart(new Date("2026-10-08T21:30:00Z")).toISOString()).toBe("2026-10-08T21:00:00.000Z");
    expect(turkeyDayStart(new Date("2026-10-08T20:59:59Z")).toISOString()).toBe("2026-10-07T21:00:00.000Z");
  });
});

describe("daemonBySource", () => {
  it("saatlik kayıtları kaynak bazında toplar", () => {
    const result = daemonBySource([
      { bySource: { dod: { inserted: 2, updated: 1, deleted: 0 }, otokoc: { inserted: 1 } } },
      { bySource: { dod: { inserted: 3, deleted: 4 } } },
      {},
    ]);
    expect(result.dod).toEqual({ added: 5, updated: 1, removed: 4 });
    expect(result.otokoc).toEqual({ added: 1, updated: 0, removed: 0 });
  });
});

describe("watcherDelta", () => {
  it("keşifle eklenen, arşive alınan ve düzeltilen ilanları toplar", () => {
    expect(
      watcherDelta([
        { inserted: 5, archived: 20, updated: 7, listCorrected: 2 },
        { archived: 3 },
      ])
    ).toEqual({ added: 5, removed: 23, updated: 9 });
  });
});

describe("manualBySource", () => {
  it("kayıtta kaynak başına sayı varsa onu kullanır", () => {
    const { bySource, unattributed } = manualBySource([
      { source: "all", inserted: 30, bySource: { dod: { inserted: 10, updated: 2 }, otokoc: { inserted: 20, updated: 0 } } },
    ]);
    expect(bySource.dod).toEqual({ added: 10, removed: 0, updated: 2 });
    expect(bySource.otokoc).toEqual({ added: 20, removed: 0, updated: 0 });
    expect(unattributed).toEqual(emptyDelta());
  });

  it("tek kaynaklı taramanın toplamını o kaynağa yazar", () => {
    const { bySource } = manualBySource([{ source: "carvak", inserted: 4, updated: 1, bySource: { carvak: { fetched: 9 } as never } }]);
    expect(bySource.carvak).toEqual({ added: 4, removed: 0, updated: 1 });
  });

  it("nadir model / fiyat taraması gibi Arabam'a özel türleri Arabam'a yazar", () => {
    const { bySource } = manualBySource([
      { source: "rare-model", inserted: 3664, updated: 0 },
      { source: "price-refresh", inserted: 0, updated: 120, deleted: 40 },
    ]);
    expect(bySource.arabam).toEqual({ added: 3664, removed: 40, updated: 120 });
  });

  it("kaynağı anlaşılamayan eski 'tümü' kaydını ayrı tutar", () => {
    const { bySource, unattributed } = manualBySource([{ source: "all", inserted: 50, updated: 5 }]);
    expect(bySource).toEqual({});
    expect(unattributed).toEqual({ added: 50, removed: 0, updated: 5 });
  });
});

describe("buildDailySummary", () => {
  const summary = buildDailySummary({
    date: "08.10.2026",
    sources: ["arabam", "dod"],
    active: { arabam: 33000, dod: 1200 },
    truthAdded: { arabam: 3700, dod: 8 },
    truthRemoved: { arabam: 410, dod: 2 },
    watcher: { added: 30, removed: 400, updated: 90 },
    daemon: { dod: { added: 8, removed: 2, updated: 5 } },
    manual: { bySource: { arabam: { added: 3664, removed: 10, updated: 0 } }, unattributed: emptyDelta() },
  });

  it("bekçiyi yalnızca Arabam satırına yazar", () => {
    expect(summary.rows[0].watcher).toEqual({ added: 30, removed: 400, updated: 90 });
    expect(summary.rows[1].watcher).toEqual(emptyDelta());
  });

  it("Toplam sütununda + ve − veritabanı gerçeğidir, ~ sütunların toplamıdır", () => {
    expect(summary.rows[0].total).toEqual({ added: 3700, removed: 410, updated: 90 });
    expect(summary.rows[1].total).toEqual({ added: 8, removed: 2, updated: 5 });
  });

  it("alt toplamları hesaplar", () => {
    expect(summary.totals.watcher).toEqual({ added: 30, removed: 400, updated: 90 });
    expect(summary.totals.daemon).toEqual({ added: 8, removed: 2, updated: 5 });
    expect(summary.totals.manual).toEqual({ added: 3664, removed: 10, updated: 0 });
    expect(summary.totals.total).toEqual({ added: 3708, removed: 412, updated: 95 });
  });
});
