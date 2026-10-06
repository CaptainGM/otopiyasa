import { describe, expect, it } from "vitest";
import { evaluateHealth, HEALTH, type HealthSnapshot } from "./health-check";

const now = new Date("2026-10-06T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const HOUR = 3_600_000;

const healthy = (): HealthSnapshot => ({
  now,
  daemon: { lastHeartbeat: ago(60_000), command: "run", status: "online" },
  watcher: { lastHeartbeat: ago(HOUR) },
  watcherLast24h: { checked: 300, uncertain: 10, blocked: 5 },
  sources: [{ source: "otokoc", lastSuccessAt: ago(5 * HOUR), lastStatus: "ok" }],
  lastListingCreatedAt: ago(HOUR),
});

describe("evaluateHealth", () => {
  it("her şey yolundayken sessizdir", () => {
    expect(evaluateHealth(healthy())).toEqual([]);
  });

  it("sunucu motoru sinyal vermezse kritik uyarı verir; elle durdurulduysa vermez", () => {
    const s = healthy();
    s.daemon = { lastHeartbeat: ago(HEALTH.daemonSilentMs + 60_000), command: "run", status: "online" };
    expect(evaluateHealth(s).map((i) => i.key)).toEqual(["daemon-silent"]);
    s.daemon.command = "stop";
    expect(evaluateHealth(s)).toEqual([]);
  });

  it("bekçi kısa süre kapalıysa (bilgisayar uykuda) uyarmaz, günlerce kapalıysa uyarır", () => {
    const s = healthy();
    s.watcher = { lastHeartbeat: ago(20 * HOUR) };
    expect(evaluateHealth(s)).toEqual([]);
    s.watcher = { lastHeartbeat: ago(HEALTH.watcherSilentMs + HOUR) };
    expect(evaluateHealth(s).map((i) => i.key)).toEqual(["watcher-silent"]);
  });

  it("ilan sayfalarının çoğu okunamıyorsa site yapısı değişmiş olabilir der", () => {
    const s = healthy();
    s.watcherLast24h = { checked: 100, uncertain: 70, blocked: 0 };
    expect(evaluateHealth(s).map((i) => i.key)).toEqual(["watcher-parse"]);
  });

  it("senkronlanamayan kurumsal kaynağı ve gelmeyen yeni ilanı bildirir", () => {
    const s = healthy();
    s.sources = [{ source: "dod", lastSuccessAt: ago(HEALTH.sourceStaleMs + HOUR), lastStatus: "failed", lastMessage: "HTTP 500" }];
    s.lastListingCreatedAt = ago(HEALTH.noNewListingsMs + HOUR);
    expect(evaluateHealth(s).map((i) => i.key)).toEqual(["source-dod", "no-new-listings"]);
  });
});
