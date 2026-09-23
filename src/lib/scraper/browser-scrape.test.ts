import { describe, it, expect } from "vitest";
import { isListingGone } from "./browser-scrape";

describe("isListingGone", () => {
  it("detects search redirect URLs as gone", () => {
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el/otomobil")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el?searchText=bmw")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ilan/ford-fiesta/123456")).toBe(false);
  });

  it("detects error text in HTML as gone", () => {
    expect(isListingGone("<div>Böyle bir ilan bulunamadı</div>")).toBe(true);
    expect(isListingGone("<div>İlan yayından kaldırılmıştır</div>")).toBe(true);
    expect(isListingGone("<div>Aradığınız ilan bulunamamıştır</div>")).toBe(true);
    expect(isListingGone("<div>Sahibinden 2022 Ford Focus Sahibinden Satılık</div>")).toBe(false);
  });
});
