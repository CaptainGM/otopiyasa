import { describe, it, expect } from "vitest";
import { vavaListingUrl } from "./vavacars";
import { dodExternalIdFromUrl, normalizeDodUrl } from "./dod";
import { createSitemapParser } from "./arabam-sitemap";

describe("vavaListingUrl", () => {
  it("sitenin güncel rotasını kullanır: tr.vava.cars/buy/cars/:make/:model/:uuid", () => {
    expect(vavaListingUrl({ id: "ce93dc2f-0fcd-4da5-ad7d-ace585d85fbf", make: "Renault", model: "Clio" })).toBe(
      "https://tr.vava.cars/buy/cars/Renault/Clio/ce93dc2f-0fcd-4da5-ad7d-ace585d85fbf"
    );
  });
  it("boşluklu model adını kaçışlar", () => {
    expect(vavaListingUrl({ id: "abc", make: "Mercedes-Benz", model: "C 200" })).toBe(
      "https://tr.vava.cars/buy/cars/Mercedes-Benz/C%20200/abc"
    );
  });
  it("kimlik yoksa katalog sayfasına düşer", () => {
    expect(vavaListingUrl({ make: "Renault", model: "Clio" })).toBe("https://tr.vava.cars/buy/cars");
  });
});

describe("normalizeDodUrl", () => {
  it("XML'deki &amp; kaçışını çözer (35 ilanda bozuk link vardı)", () => {
    expect(normalizeDodUrl("https://www.dod.com.tr/arac-detay/seat-ibiza-10-eco-tsi-110-hp-dsg-s&amp;s-style-264200229")).toBe(
      "https://dod.com.tr/arac-detay/seat-ibiza-10-eco-tsi-110-hp-dsg-s&s-style-264200229"
    );
  });
  it("www'yu atar (site zaten dod.com.tr'ye 301 veriyor)", () => {
    expect(normalizeDodUrl("https://www.dod.com.tr/arac-detay/x-253460531")).toBe("https://dod.com.tr/arac-detay/x-253460531");
  });
  it("ilan numarasını adresin sonundan alır", () => {
    expect(dodExternalIdFromUrl("https://dod.com.tr/arac-detay/x-s&s-style-264200229")).toBe("dod-264200229");
    expect(dodExternalIdFromUrl("https://dod.com.tr/arac-detay/x")).toBeNull();
  });
});

describe("createSitemapParser", () => {
  const entry = (id: string, lastmod: string) =>
    `<url><loc>https://www.arabam.com/ilan/galeriden-satilik-bmw/baslik/${id}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>`;

  it("ilan numarası ve lastmod çiftlerini çıkarır, ilan dışı adresleri atlar", () => {
    const seen: Array<[string, string]> = [];
    const parser = createSitemapParser((id, lm) => seen.push([id, lm]));
    parser.push(
      `<urlset>${entry("111", "2026-08-11")}<url><loc>https://www.arabam.com/ikinci-el/otomobil/nissan</loc><lastmod>2026-09-30</lastmod></url>${entry("222", "2026-09-01")}</urlset>`
    );
    parser.end();
    expect(seen).toEqual([
      ["111", "2026-08-11"],
      ["222", "2026-09-01"],
    ]);
  });

  it("parça sınırında bölünen kaydı kaybetmez (akışla okuma)", () => {
    const xml = `<urlset>${entry("1001", "2026-01-01")}${entry("1002", "2026-01-02")}${entry("1003", "2026-01-03")}</urlset>`;
    for (const chunkSize of [7, 50, 113, 400]) {
      const seen: string[] = [];
      const parser = createSitemapParser((id) => seen.push(id));
      for (let i = 0; i < xml.length; i += chunkSize) parser.push(xml.slice(i, i + chunkSize));
      parser.end();
      expect(seen).toEqual(["1001", "1002", "1003"]);
    }
  });
});
