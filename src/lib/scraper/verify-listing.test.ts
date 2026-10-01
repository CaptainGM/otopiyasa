import { describe, it, expect } from "vitest";
import { BlockStreak, classifyOtokocHtml, classifyRedirect, listingIdFromUrl } from "./verify-listing";

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

describe("BlockStreak", () => {
  it("art arda 4 engelden sonra kaynağı durdurur, yalnızca o kaynağı", () => {
    const streak = new BlockStreak(4);
    expect([1, 2, 3].map(() => streak.record("arabam", "blocked"))).toEqual([false, false, false]);
    expect(streak.record("arabam", "blocked")).toBe(true);
    expect(streak.isPaused("arabam")).toBe(true);
    expect(streak.isPaused("otokoc")).toBe(false);
    // Durdurma bir kez bildirilir.
    expect(streak.record("arabam", "blocked")).toBe(false);
    expect(streak.pausedSources).toEqual(["arabam"]);
  });

  it("araya giren her başarılı doğrulama sayacı sıfırlar", () => {
    const streak = new BlockStreak(4);
    for (let i = 0; i < 20; i++) {
      streak.record("arabam", "blocked");
      streak.record("arabam", "blocked");
      streak.record("arabam", "blocked");
      streak.record("arabam", "active");
    }
    expect(streak.isPaused("arabam")).toBe(false);
  });

  it("zaman aşımı gibi diğer hatalar engel sayılmaz", () => {
    const streak = new BlockStreak(2);
    for (let i = 0; i < 10; i++) streak.record("arabam", "error");
    expect(streak.isPaused("arabam")).toBe(false);
  });
});
