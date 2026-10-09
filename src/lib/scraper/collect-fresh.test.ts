import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scraper/browser-scrape", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scraper/browser-scrape")>();
  return { ...actual, fetchPageHtml: vi.fn(), fetchPageWithBrowser: vi.fn() };
});

const carRows: { current: Array<{ externalId: string; status?: string; removedReason?: string }> } = { current: [] };
vi.mock("@/models/Car", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/Car")>();
  return {
    ...actual,
    Car: { ...actual.Car, find: vi.fn(() => ({ lean: async () => carRows.current })) },
  };
});

import { fetchPageHtml } from "@/lib/scraper/browser-scrape";
import { collectFreshArabamHrefs } from "./adapters";

const mockedFetch = vi.mocked(fetchPageHtml);
const BASE = "https://www.arabam.com/ikinci-el/otomobil/audi-a7";

const link = (id: number) => `<a href="/ilan/galeriden-satilik-audi-a7/baslik/${id}">x</a>`;
const realPage = (ids: number[], title = "Audi A7 Fiyatları ve İlanları - arabam.com") =>
  `<html><head><title>${title}</title></head><body>${ids.map(link).join("")}<!--${"x".repeat(200_000)}--></body></html>`;
const page = (html: string, finalUrl = BASE) => ({ ok: true, status: 200, html, finalUrl });

describe("collectFreshArabamHrefs", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    carRows.current = [];
  });

  it("model adresi markanın sayfasına yönleniyorsa hiçbir ilan almaz (unavailable)", async () => {
    mockedFetch.mockResolvedValue(page(realPage([1, 2, 3]), "https://www.arabam.com/ikinci-el/otomobil/audi"));
    const res = await collectFreshArabamHrefs(BASE, 5, 3, "audi-a7");
    expect(res.outcome).toBe("unavailable");
    expect(res.fresh).toEqual([]);
  });

  it("gerçek ama ilansız sayfa 'empty', engel/hata sayfası 'unknown' sayılır", async () => {
    mockedFetch.mockResolvedValueOnce(page(realPage([])));
    expect((await collectFreshArabamHrefs(BASE, 5, 3, "audi-a7")).outcome).toBe("empty");
    mockedFetch.mockResolvedValueOnce(page("<html><title>Bir dakika lütfen...</title></html>"));
    expect((await collectFreshArabamHrefs(BASE, 5, 3, "audi-a7")).outcome).toBe("unknown");
  });

  it("bizde olmayan ilanları alır, aktif olanları atlar", async () => {
    carRows.current = [{ externalId: "arabam-1", status: "active" }];
    mockedFetch.mockResolvedValueOnce(page(realPage([1, 2, 3])));
    const res = await collectFreshArabamHrefs(BASE, 5, 1, "audi-a7");
    expect(res.fresh.map((h) => h.split("/").pop())).toEqual(["2", "3"]);
  });

  it("arşivdeki ilan güncel sayfada listeleniyorsa aday olur; elle kaldırılan / kapsam dışı olmaz", async () => {
    carRows.current = [
      { externalId: "arabam-1", status: "removed", removedReason: "arabam: İlan sayfası kaldırılmış" },
      { externalId: "arabam-2", status: "removed", removedReason: "Manuel: yönetici kaldırdı" },
      { externalId: "arabam-3", status: "removed", removedReason: "arabam: Platform dışı araç (ATV)" },
      { externalId: "arabam-4", status: "removed" },
    ];
    mockedFetch.mockResolvedValueOnce(page(realPage([1, 2, 3, 4, 5])));
    const res = await collectFreshArabamHrefs(BASE, 10, 1, "audi-a7");
    expect(res.fresh.map((h) => h.split("/").pop()).sort()).toEqual(["1", "4", "5"]);
  });

  it("kota dolunca durur ve kota kadar ilan verir", async () => {
    mockedFetch.mockResolvedValueOnce(page(realPage(Array.from({ length: 20 }, (_, i) => 100 + i))));
    const res = await collectFreshArabamHrefs(BASE, 4, 3, "audi-a7");
    expect(res.outcome).toBe("satisfied");
    expect(res.fresh).toHaveLength(4);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
