import { describe, expect, it } from "vitest";
import { describeWatcher, estimateRemaining, fillDayHours, formatActiveTime, summarizeDays, WATCHER_STALE_MS } from "./home-watcher-status";
import { turkeyHourOf } from "@/models/HomeWatcher";

const now = new Date("2026-10-03T12:00:00Z").getTime();

describe("describeWatcher", () => {
  it("hiç kayıt yoksa 'hiç çalışmadı' der", () => {
    const s = describeWatcher(null, now);
    expect(s.state).toBe("offline");
    expect(s.label).toBe("Hiç çalışmadı");
  });

  it("taze sinyal gelen bekçi çalışıyordur", () => {
    const s = describeWatcher({ status: "running", phase: "Doğrulanıyor", lastHeartbeat: new Date(now - 30_000), gapSeconds: 10, host: "EV-PC" }, now);
    expect(s.state).toBe("online");
    expect(s.phase).toBe("Doğrulanıyor");
    expect(s.gapSeconds).toBe(10);
    expect(s.host).toBe("EV-PC");
  });

  it("engel molasını ayırır ve bitiş zamanını verir", () => {
    const until = new Date(now + 15 * 60_000);
    const s = describeWatcher({ status: "paused", lastHeartbeat: new Date(now - 10_000), pausedUntil: until }, now);
    expect(s.state).toBe("paused");
    expect(s.pausedUntil).toBe(until.toISOString());
  });

  it("sinyal 3 dakikadan eskiyse kapalı sayar (bilgisayar kapalı olabilir)", () => {
    const s = describeWatcher({ status: "running", phase: "Doğrulanıyor", lastHeartbeat: new Date(now - WATCHER_STALE_MS - 1000) }, now);
    expect(s.state).toBe("offline");
    expect(s.phase).toBe("");
    expect(s.label).toContain("Kapalı");
  });

  it("kapatılırken 'durdu' yazan bekçi taze sinyalle bile çalışıyor sayılmaz", () => {
    const s = describeWatcher({ status: "stopped", lastHeartbeat: new Date(now - 5000) }, now);
    expect(s.state).toBe("offline");
    expect(s.label).toBe("Durdu");
  });
});

describe("turkeyHourOf", () => {
  it("UTC anını Türkiye saatine çevirir (UTC+3)", () => {
    const r = turkeyHourOf(new Date("2026-10-03T10:20:00Z"));
    expect(r.dateStr).toBe("03.10.2026");
    expect(r.hour).toBe(13);
    expect(r.timestamp.toISOString()).toBe("2026-10-03T10:00:00.000Z");
  });

  it("gece yarısını geçince Türkiye gününü değiştirir", () => {
    const r = turkeyHourOf(new Date("2026-10-03T21:30:00Z"));
    expect(r.dateStr).toBe("04.10.2026");
    expect(r.hour).toBe(0);
    expect(r.timestamp.toISOString()).toBe("2026-10-03T21:00:00.000Z");
  });
});

const row = (dateStr: string, hour: number, checked: number, extra: Record<string, number> = {}) => ({
  dateStr,
  hour,
  checked,
  alive: Math.round(checked * 0.9),
  archived: checked - Math.round(checked * 0.9),
  blocked: 0,
  uncertain: 0,
  batches: 1,
  ...extra,
});

describe("summarizeDays", () => {
  it("saatleri güne toplar, en yeni gün başta, çalışılan süreyi toplar", () => {
    const days = summarizeDays([row("02.10.2026", 20, 300), row("03.10.2026", 9, 100, { activeSeconds: 300 }), row("03.10.2026", 10, 200, { blocked: 4, pausedMinutes: 15, activeSeconds: 300 })]);
    expect(days.map((d) => d.dateStr)).toEqual(["03.10.2026", "02.10.2026"]);
    expect(days[0].checked).toBe(300);
    expect(days[0].activeSeconds).toBe(600);
    expect(days[0].blocked).toBe(4);
    expect(days[0].pausedMinutes).toBe(15);
  });

  it("ayları doğru sıralar (31.12 → 01.01)", () => {
    const days = summarizeDays([row("31.12.2026", 1, 10), row("01.01.2027", 1, 10)]);
    expect(days.map((d) => d.dateStr)).toEqual(["01.01.2027", "31.12.2026"]);
  });
});

describe("fillDayHours", () => {
  it("24 saati döndürür, çalışılmayan saatler sıfır olur", () => {
    const slots = fillDayHours("03.10.2026", [row("03.10.2026", 13, 120), row("02.10.2026", 13, 999)]);
    expect(slots).toHaveLength(24);
    expect(slots[13].checked).toBe(120);
    expect(slots[13].hourRange).toBe("13:00 - 14:00");
    expect(slots[12].checked).toBe(0);
    expect(slots[23].hourRange).toBe("23:00 - 00:00");
  });
});

describe("formatActiveTime", () => {
  it("saniyeyi okunur süreye çevirir", () => {
    expect(formatActiveTime(4500)).toBe("1 sa 15 dk");
    expect(formatActiveTime(3600)).toBe("1 sa");
    expect(formatActiveTime(700)).toBe("12 dk");
    expect(formatActiveTime(20)).toBe("<1 dk");
    expect(formatActiveTime(0)).toBe("—");
  });
});

describe("estimateRemaining", () => {
  it("veri yoksa tahmin vermez", () => {
    expect(estimateRemaining(1000, [])).toBeNull();
  });

  it("çalışılan süreden saat başına hızı ve kalan çalışma saatini hesaplar", () => {
    // 2 saatlik tam çalışma: 740 ilan → saatte 370.
    const days = summarizeDays([row("03.10.2026", 9, 370, { activeSeconds: 3600 }), row("03.10.2026", 10, 370, { activeSeconds: 3600 })]);
    expect(estimateRemaining(7400, days)).toEqual({ perActiveHour: 370, activeHoursNeeded: 20 });
  });

  it("5 dakikadan az veriyle tahmin vermez", () => {
    const days = summarizeDays([row("03.10.2026", 14, 20, { activeSeconds: 195 })]);
    expect(estimateRemaining(23000, days)).toBeNull();
  });
});
