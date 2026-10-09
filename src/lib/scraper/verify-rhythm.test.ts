import { describe, expect, it } from "vitest";
import { blockWaitMinutes, judgeBatch, MAX_BLOCK_STREAK } from "./verify-rhythm";

describe("blockWaitMinutes", () => {
  it("10, 20, 40 dk ve sonra en çok 60 dk bekler", () => {
    expect([1, 2, 3, 4, 5, 6].map(blockWaitMinutes)).toEqual([10, 20, 40, 60, 60, 60]);
  });
});

describe("judgeBatch", () => {
  it("engelsiz ya da az engelli parti normaldir ve engel serisini sıfırlar", () => {
    expect(judgeBatch({ checked: 250, blocked: 0 }, 3)).toEqual({ kind: "ok", streak: 0 });
    expect(judgeBatch({ checked: 250, blocked: 60 }, 2)).toEqual({ kind: "ok", streak: 0 });
  });

  it("ilanların %30'u ya da fazlası engelliyse dinlenir", () => {
    expect(judgeBatch({ checked: 250, blocked: 75 }, 0)).toEqual({ kind: "blocked", streak: 1, waitMinutes: 10 });
    expect(judgeBatch({ checked: 100, blocked: 100 }, 1)).toEqual({ kind: "blocked", streak: 2, waitMinutes: 20 });
  });

  it("art arda engelle yarıda kalan parti her zaman engeldir", () => {
    expect(judgeBatch({ checked: 5, blocked: 5, aborted: true }, 0).kind).toBe("blocked");
    // Az ilan denendi ama parti bırakıldı: oran küçük görünse de engeldir.
    expect(judgeBatch({ checked: 200, blocked: 5, aborted: true }, 0).kind).toBe("blocked");
  });

  it("kuyruk boşsa (hiç ilan denenmedi) engel sayılmaz, biter", () => {
    expect(judgeBatch({ checked: 0, blocked: 0 }, 2)).toEqual({ kind: "empty", streak: 2 });
  });

  it("molalara rağmen düzelmezse vazgeçer", () => {
    expect(judgeBatch({ checked: 10, blocked: 10 }, MAX_BLOCK_STREAK - 1).kind).toBe("blocked");
    expect(judgeBatch({ checked: 10, blocked: 10 }, MAX_BLOCK_STREAK)).toEqual({ kind: "give-up", streak: MAX_BLOCK_STREAK + 1 });
  });
});
