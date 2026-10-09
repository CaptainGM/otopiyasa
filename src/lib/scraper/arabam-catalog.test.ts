import { describe, expect, it } from "vitest";
import { parseBrandModels, parseCategoryBrands, parseFacetLinks } from "./arabam-catalog";

const item = (path: string, name: string, count: string) =>
  `<li><a href="/ikinci-el/${path}" class="list-item \n  \n ">\n   ${name}\n   <span class="count">\n  ${count}\n  </span></a></li> `;

const brandPage =
  item("otomobil", "Otomobil", "173.968") +
  item("otomobil/hyundai", "Hyundai", "9.700") +
  item("otomobil/hyundai-i20", "i20", "2.598") +
  item("otomobil/hyundai-i20-active", "i20 Active", "33") +
  item("otomobil/hyundai-i20-n", "i20 N", "21") +
  item("otomobil/hyundai-sahibinden", "Sahibinden", "100") +
  item("otomobil/hyundai-i20", "i20", "2.598") +
  item("otomobil/honda-civic", "Civic", "800");

describe("parseFacetLinks", () => {
  it("bağlantıdaki adı ve noktalı ilan sayısını okur", () => {
    const links = parseFacetLinks(brandPage);
    expect(links[0]).toEqual({ path: "otomobil", name: "Otomobil", count: 173968 });
    expect(links.find((l) => l.path === "otomobil/hyundai-i20-n")).toEqual({ path: "otomobil/hyundai-i20-n", name: "i20 N", count: 21 });
  });
});

describe("parseCategoryBrands", () => {
  it("yalnızca kategorinin doğrudan altındaki marka sayfalarını alır", () => {
    const brands = parseCategoryBrands(parseFacetLinks(item("otomobil", "Otomobil", "5") + item("otomobil/alfa-romeo", "Alfa Romeo", "293") + item("otomobil/alfa-romeo-giulia", "Giulia", "9")), "otomobil");
    // "alfa-romeo-giulia" da tek parça yol olduğu için marka listesinde görünebilir; marka sayfası listesinde model satırı gelmez.
    expect(brands.map((b) => b.slug)).toContain("alfa-romeo");
    expect(brands.find((b) => b.slug === "alfa-romeo")?.name).toBe("Alfa Romeo");
  });
});

describe("parseBrandModels", () => {
  const models = parseBrandModels(parseFacetLinks(brandPage), "otomobil", "hyundai");

  it("markanın modellerini ayrı satır olarak verir: i20, i20 Active, i20 N", () => {
    expect(models.map((m) => m.name)).toEqual(["i20", "i20 Active", "i20 N"]);
    expect(models.find((m) => m.name === "i20 N")).toEqual({ name: "i20 N", slug: "hyundai-i20-n", count: 21 });
  });

  it("satıcı/il filtresi ve başka marka model sayılmaz, tekrar eden satır bir kez gelir", () => {
    expect(models.some((m) => m.slug === "hyundai-sahibinden")).toBe(false);
    expect(models.some((m) => m.slug.startsWith("honda"))).toBe(false);
    expect(models.filter((m) => m.name === "i20")).toHaveLength(1);
  });
});
