import { describe, it, expect } from "vitest";
import { classifyArabamSearchResponse, classifyOtokocHtml, classifyRedirect, listingIdFromUrl } from "./verify-listing";

describe("classifyOtokocHtml", () => {
  const notFoundBoundary = '{"children":"404 | Sayfa Bulunamadı"}';
  it("gerçek ilan verisi olan sayfa canlıdır (404 bileşeni canlı sayfalarda da gömülü olsa bile)", () => {
    const live = `<script type="application/ld+json">{"@type":"Product","name":"Fiat Egea"}</script>${notFoundBoundary}`;
    expect(classifyOtokocHtml(live)).toBe("live");
  });
  it("ilan verisi yok ve 404 bileşeni gösteriliyorsa satılmıştır (soft 404)", () => {
    expect(classifyOtokocHtml(`<html><h1>404 | Sayfa Bulunamadı</h1></html>`)).toBe("gone");
  });
  it("ikisi de yoksa belirsizdir, ilan öldürülmez", () => {
    expect(classifyOtokocHtml("<html><body>Bakım çalışması</body></html>")).toBe("unknown");
  });
});

describe("classifyArabamSearchResponse", () => {
  it("canlı ilanda ilan sayfasına 302'yi canlı sayar", () => {
    const r = classifyArabamSearchResponse(302, "/ilan/galeriden-satilik-bmw/calislar-center/43138071", "");
    expect(r.status).toBe("active");
    expect(r.finalUrl).toBe("https://www.arabam.com/ilan/galeriden-satilik-bmw/calislar-center/43138071");
  });

  it("aramada 'Sonuç bulunamadı' yazıyorsa ölü sayar (canlı sitede ölçüldü)", () => {
    const body = "<div>Anahtar Kelime 1234567 Seçimleri Temizle Sonuç bulunamadı. Filtrelerinizi silerek...</div>";
    expect(classifyArabamSearchResponse(200, "", body).status).toBe("gone");
  });

  it("Cloudflare engel sayfasını asla ölü saymaz", () => {
    const challenge = "<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>";
    expect(classifyArabamSearchResponse(200, "", challenge).status).toBe("blocked");
    expect(classifyArabamSearchResponse(403, "", challenge).status).toBe("blocked");
    expect(classifyArabamSearchResponse(429, "", "").status).toBe("blocked");
  });

  it("tanınmayan 200 yanıtını ölü saymaz (eski kod her 200'ü ölü sayıyordu)", () => {
    const r = classifyArabamSearchResponse(200, "", "<html><body>Beklenmeyen bir sayfa</body></html>");
    expect(r.status).toBe("error");
  });

  it("ana sayfaya ya da ilan dışı bir yere 302'yi ölü saymaz", () => {
    expect(classifyArabamSearchResponse(302, "/", "").status).toBe("error");
    expect(classifyArabamSearchResponse(302, "https://www.arabam.com/hata", "").status).toBe("error");
  });

  it("404/410'u ölü sayar", () => {
    expect(classifyArabamSearchResponse(404, "", "").status).toBe("gone");
    expect(classifyArabamSearchResponse(410, "", "").status).toBe("gone");
  });
});

describe("listingIdFromUrl", () => {
  it("adresin sonundaki ilan numarasını bulur", () => {
    expect(listingIdFromUrl("https://www.otoplus.com/kia/sportage/sportage-1-6-mavi-ekspertizli-Ankara-1050000tl-574590")).toBe("574590");
    expect(listingIdFromUrl("https://www.arabam.com/ilan/bmw/x/43138071")).toBe("43138071");
  });
  it("?id= parametresini önceler (Carvak)", () => {
    expect(listingIdFromUrl("https://carvak.com/tr/ikinci-el/cupra-leon-hatchback-2023?id=51234")).toBe("51234");
  });
  it("numara yoksa null döner", () => {
    expect(listingIdFromUrl("https://www.otoplus.com/kia/sportage")).toBeNull();
  });
});

describe("classifyRedirect", () => {
  const original = "https://www.otoplus.com/kia/sportage/sportage-1-6-ekspertizli-Ankara-1050000tl-574590";
  it("yönlendirme yoksa 'same'", () => {
    expect(classifyRedirect(original, original)).toBe("same");
  });
  it("ana sayfaya yönlendirmeyi 'root' sayar (kanıt değil: bot/bölge filtresi de yapar)", () => {
    expect(classifyRedirect("https://www.vava.cars/tr/buy-cars/nissan/qashqai/283255", "https://tr.vava.cars/")).toBe("root");
    expect(classifyRedirect(original, "https://www.otoplus.com")).toBe("root");
  });
  it("ilan numarasını kaybeden yönlendirmeyi 'lost-id' sayar (satılan Otoplus ilanı model kataloğuna yönleniyor)", () => {
    expect(classifyRedirect(original, "https://www.otoplus.com/kia/sportage")).toBe("lost-id");
  });
  it("ilan numarasını koruyan yönlendirmeyi (adres normalleştirme) ölü saymaz", () => {
    expect(classifyRedirect(original, "https://otoplus.com/kia/sportage/sportage-1-6-ekspertizli-Ankara-1050000tl-574590")).toBe("moved");
  });
});
