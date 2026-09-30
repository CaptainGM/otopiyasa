import { describe, it, expect } from "vitest";
import { isCloudflareChallenge, isListingGone } from "./browser-scrape";

describe("isListingGone", () => {
  it("detects search redirect URLs as gone", () => {
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el/otomobil")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el?searchText=bmw")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ilan/ford-fiesta/123456")).toBe(false);
    // Kaldırılan ilan model kategorisine yönlenir (canlı sitede ölçüldü)
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el/otomobil/peugeot-206-1-4-fever")).toBe(true);
  });

  it("does not treat a redirect to the home page as proof of removal", () => {
    // Bot/bölge filtresi de ana sayfaya yönlendirir; bu ilanı öldürmemeli.
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/")).toBe(false);
    expect(isListingGone("<html>...</html>", "https://tr.vava.cars/")).toBe(false);
  });
});

describe("isCloudflareChallenge", () => {
  it("recognises the Cloudflare interstitial", () => {
    expect(isCloudflareChallenge('<!DOCTYPE html><html><head><title>Just a moment...</title>')).toBe(true);
    expect(isCloudflareChallenge('<script src="https://challenges.cloudflare.com/turnstile"></script>')).toBe(true);
    expect(isCloudflareChallenge("<html><head><title>Sahibinden BMW 3 Serisi</title></head></html>")).toBe(false);
    expect(isCloudflareChallenge("")).toBe(false);
  });

  it("detects error text in HTML as gone", () => {
    expect(isListingGone("<div>Böyle bir ilan bulunamadı</div>")).toBe(true);
    expect(isListingGone("<div>İlan yayından kaldırılmıştır</div>")).toBe(true);
    expect(isListingGone("<div>Aradığınız ilan bulunamamıştır</div>")).toBe(true);
    expect(isListingGone("<div>Sahibinden 2022 Ford Focus Sahibinden Satılık</div>")).toBe(false);
  });
});
