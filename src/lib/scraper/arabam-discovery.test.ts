import { describe, it, expect } from "vitest";
import { NewestCandidates, createSitemapParser, hrefFromUrl } from "./arabam-sitemap";

describe("NewestCandidates", () => {
  const add = (c: NewestCandidates, ids: number[]) => ids.forEach((id) => c.add(String(id), "2026-09-30", `https://www.arabam.com/ilan/x/${id}`));

  it("bilinen en büyük numaradan büyük ve bizde olmayan ilanları seçer", () => {
    const c = new NewestCandidates(1000, 10, new Set(["1002"]));
    add(c, [900, 1000, 1001, 1002, 1003]);
    expect(c.result().map((x) => x.id)).toEqual(["1003", "1001"]); // en yeni önce, bilinen 1002 ve eşik altı yok
  });

  it("sınırı aşınca yalnızca en yeni N adayı tutar", () => {
    const c = new NewestCandidates(0, 3, new Set());
    add(c, Array.from({ length: 100 }, (_, i) => i + 1));
    expect(c.result().map((x) => x.num)).toEqual([100, 99, 98]);
  });

  it("geçersiz numarayı atlar", () => {
    const c = new NewestCandidates(0, 3, new Set());
    c.add("abc", "2026-01-01", "https://www.arabam.com/ilan/x/abc");
    expect(c.result()).toEqual([]);
  });
});

describe("createSitemapParser (adres)", () => {
  it("numara, lastmod ve tam adresi verir", () => {
    const got: Array<[string, string, string]> = [];
    const p = createSitemapParser((id, lm, url) => got.push([id, lm, url]));
    p.push(
      `<url><loc>https://www.arabam.com/ilan/galeriden-satilik-bmw/baslik/43138071</loc><lastmod>2026-09-30</lastmod></url>`
    );
    p.end();
    expect(got).toEqual([["43138071", "2026-09-30", "https://www.arabam.com/ilan/galeriden-satilik-bmw/baslik/43138071"]]);
  });
});

describe("hrefFromUrl", () => {
  it("adresin yol kısmını döndürür, bozuk adreste null", () => {
    expect(hrefFromUrl("https://www.arabam.com/ilan/a/b/123")).toBe("/ilan/a/b/123");
    expect(hrefFromUrl("not a url")).toBeNull();
  });
});
