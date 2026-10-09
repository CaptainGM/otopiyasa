import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scraper/browser-scrape", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scraper/browser-scrape")>();
  return { ...actual, fetchPageHtml: vi.fn() };
});

import { fetchPageHtml } from "@/lib/scraper/browser-scrape";
import { createDetailFetchStats, refetchArabamDetails } from "./adapters";

const mocked = vi.mocked(fetchPageHtml);
const blocked = { ok: false, status: 403, html: "", finalUrl: "" };
const alive = { ok: true, status: 200, html: "<html></html>", finalUrl: "https://www.arabam.com/ilan/x/1" };
const hrefs = (n: number) => Array.from({ length: n }, (_, i) => `/ilan/galeriden-satilik-test/baslik/${1000 + i}`);

describe("refetchArabamDetails engel istatistiği", () => {
  beforeEach(() => mocked.mockReset());

  it("art arda 5 engelde partiyi bırakır, kalan ilanlara hiç dokunmaz", async () => {
    mocked.mockResolvedValue(blocked);
    const stats = createDetailFetchStats();
    const saved = await refetchArabamDetails(hrefs(12), async () => {}, undefined, 0, 12, stats);
    expect(saved).toBe(0);
    expect(stats.aborted).toBe(true);
    expect(stats.blocked.size).toBe(5);
    expect(stats.attempted.size).toBe(5);
    expect(mocked).toHaveBeenCalledTimes(5);
  });

  it("araya giren başarılı okuma engel serisini sıfırlar", async () => {
    mocked
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce(alive)
      .mockResolvedValue(blocked);
    const stats = createDetailFetchStats();
    await refetchArabamDetails(hrefs(7), async () => {}, undefined, 0, 7, stats);
    // 2 engel, 1 başarılı, sonra 4 engel (5'e ulaşmaz): hepsi denenir, parti bırakılmaz.
    expect(stats.attempted.size).toBe(7);
    expect(stats.blocked.size).toBe(6);
    expect(stats.aborted).toBe(false);
  });

  it("404 ölü ilan sayılır, engel sayılmaz", async () => {
    mocked.mockResolvedValue({ ok: false, status: 404, html: "", finalUrl: "" });
    const stats = createDetailFetchStats();
    const gone: string[] = [];
    await refetchArabamDetails(hrefs(8), async () => {}, (href) => gone.push(href), 0, 8, stats);
    expect(gone).toHaveLength(8);
    expect(stats.blocked.size).toBe(0);
    expect(stats.aborted).toBe(false);
  });

  it("ağ hatası (sayfa hiç okunamadı) engel sayılır", async () => {
    mocked.mockRejectedValueOnce(new Error("ECONNRESET")).mockRejectedValueOnce(new Error("ETIMEDOUT")).mockRejectedValueOnce(new Error("ECONNRESET"));
    const stats = createDetailFetchStats();
    await refetchArabamDetails(hrefs(3), async () => {}, undefined, 0, 3, stats);
    expect(stats.blocked.size).toBe(3);
  });
});
