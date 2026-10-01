import { describe, expect, it } from "vitest";
import { averagePrices, cityKey, parsePetrolOfisiPrices, pricesForCity } from "./fuel-prices";

// Canlı fiyat sayfasının yapısı (2026-10 ölçümü), iki il ile kısaltılmış.
const cell = (withTax: string, unit = "TL/LT") =>
  `<td><span class="with-tax">${withTax}</span><span class="without-tax">1.00</span>${unit}<sup class="without-tax">+KDV</sup></td>`;
const HTML = `<table><thead><tr><th>Şehir</th><th>V/Max Kurşunsuz 95</th><th>V/Max Diesel</th><th>Gazyağı</th><th>Kalorifer Yakıtı</th><th>Fuel Oil</th><th>PO/gaz Otogaz</th></tr></thead><tbody>
<tr class="price-row district-03431" data-disctrict-id="03431" data-disctrict-name="ISTANBUL (AVRUPA)"><td>ISTANBUL (AVRUPA)</td>${cell("84.50")}${cell("97.10")}${cell("98.66")}${cell("65.95", "TL/KG")}${cell("48.92", "TL/KG")}${cell("36.44")}</tr>
<tr class="price-row district-03400" data-disctrict-id="03400" data-disctrict-name="ISTANBUL (ANADOLU)"><td>ISTANBUL (ANADOLU)</td>${cell("84.40")}${cell("97.00")}${cell("98.50")}${cell("65.90", "TL/KG")}${cell("48.90", "TL/KG")}${cell("36.30")}</tr>
<tr class="price-row district-00600" data-disctrict-id="00600" data-disctrict-name="ANKARA"><td>ANKARA</td>${cell("85.60")}${cell("98.30")}${cell("98.80")}${cell("66.00", "TL/KG")}${cell("49.00", "TL/KG")}${cell("36.90")}</tr>
</tbody></table>`;

describe("parsePetrolOfisiPrices", () => {
  it("il satırlarından vergili benzin, motorin ve otogaz fiyatını okur", () => {
    const cities = parsePetrolOfisiPrices(HTML);
    expect(cities).toHaveLength(3);
    expect(cities[0]).toEqual({ key: "ISTANBUL (AVRUPA)", name: "ISTANBUL (AVRUPA)", benzin: 84.5, dizel: 97.1, lpg: 36.44 });
    expect(cities[2].lpg).toBe(36.9);
  });

  it("tablo tanınmazsa boş döner", () => {
    expect(parsePetrolOfisiPrices("<html><body>bakımda</body></html>")).toEqual([]);
  });
});

describe("pricesForCity", () => {
  const cities = parsePetrolOfisiPrices(HTML);
  const prices = { source: "test", fetchedAt: new Date(), cities, average: averagePrices(cities) };

  it("ilanın ilinin fiyatını kullanır; İstanbul'un iki yakasının ortalamasını alır", () => {
    expect(pricesForCity(prices, "İstanbul")).toMatchObject({ benzin: 84.45, dizel: 97.05, place: "İstanbul" });
    expect(pricesForCity(prices, "Ankara").lpg).toBe(36.9);
  });

  it("il bulunamazsa ülke ortalamasına düşer", () => {
    const p = pricesForCity(prices, "Muş");
    expect(p.place).toBe("Türkiye ortalaması");
    expect(p.benzin).toBe(averagePrices(cities).benzin);
  });

  it("kısa ve parantezli il adlarını eşler", () => {
    const withAfyon = { ...prices, cities: [...cities, { key: "AFYON", name: "AFYON", benzin: 86.1 }] };
    expect(pricesForCity(withAfyon, "Afyonkarahisar")).toMatchObject({ benzin: 86.1, place: "Afyonkarahisar" });
    expect(pricesForCity(prices, "Ankara (Merkez)").place).toBe("Ankara (Merkez)");
  });

  it("Türkçe harfleri anahtarda sadeleştirir", () => {
    expect(cityKey("Kahramanmaraş")).toBe("KAHRAMANMARAS");
    expect(cityKey("İzmir")).toBe("IZMIR");
  });
});
