import { describe, expect, it } from "vitest";
import { isRealListPage, isRequestedModelPage, judgeAttempt, lastSlug, reasonLabel } from "./model-page";

describe("lastSlug", () => {
  it("adresin son yol parçasını verir, sorguyu atar", () => {
    expect(lastSlug("https://www.arabam.com/ikinci-el/otomobil/audi-a7?page=2")).toBe("audi-a7");
    expect(lastSlug("arazi-suv-pick-up/byd-seal-u-ev")).toBe("byd-seal-u-ev");
    expect(lastSlug("/ikinci-el/otomobil/audi/")).toBe("audi");
  });
});

describe("isRequestedModelPage", () => {
  it("aynı sayfayı ve aynı modelin alt sayfasını kabul eder", () => {
    expect(isRequestedModelPage("hyundai-h-100", "https://www.arabam.com/ikinci-el/minivan-panelvan/hyundai-h-100")).toBe(true);
    // "mercedes-benz-190" kaynakta "190 D" alt sayfasına yönleniyor (ölçüldü).
    expect(isRequestedModelPage("mercedes-benz-190", "https://www.arabam.com/ikinci-el/otomobil/mercedes-benz-190-190-d?page=2")).toBe(true);
  });

  it("markanın genel sayfasına ya da kardeş modele yönlenmeyi reddeder", () => {
    expect(isRequestedModelPage("audi-a7", "https://www.arabam.com/ikinci-el/otomobil/audi")).toBe(false);
    expect(isRequestedModelPage("byd-seal-u-ev", "https://www.arabam.com/ikinci-el/arazi-suv-pick-up/byd")).toBe(false);
    expect(isRequestedModelPage("nissan-laurel-altima", "https://www.arabam.com/ikinci-el/otomobil/nissan")).toBe(false);
    // "hyundai-ioniq" ile "hyundai-ioniq6" ayrı modeldir: önek yetmez, sınırda "-" olmalı.
    expect(isRequestedModelPage("hyundai-ioniq", "https://www.arabam.com/ikinci-el/otomobil/hyundai-ioniq6")).toBe(false);
  });
});

describe("isRealListPage", () => {
  const page = (title: string, size = 500_000) => `<html><head><title>${title}</title></head><body>${"x".repeat(size)}</body></html>`;

  it("ilansız bile gerçek bir Arabam liste sayfasını tanır", () => {
    expect(isRealListPage(page("İkinci El Hyundai Kona Elektrik Arazi, SUV, Pick-up Fiyatları ve İlanları"))).toBe(true);
    expect(isRealListPage(page("Mercedes - Benz 190 D 2. El Fiyatları ve Satılık İlanları - Sayfa 3"))).toBe(true);
  });

  it("küçük hata / engel sayfasını ve başlıksız büyük sayfayı gerçek saymaz", () => {
    expect(isRealListPage("")).toBe(false);
    expect(isRealListPage(page("Bir dakika lütfen...", 3_000))).toBe(false);
    expect(isRealListPage(page("Just a moment...", 400_000))).toBe(false);
  });
});

describe("judgeAttempt", () => {
  const base = { added: 0, fresh: 0 };

  it("güvenilmeyen sayfa sonuçlarını kısa süre sonra yeniden dener, 14 gün kilitlemez", () => {
    expect(judgeAttempt({ ...base, outcome: "unknown" })).toEqual({ reason: "unknown", retryDays: 1 });
    expect(judgeAttempt({ ...base, outcome: "unavailable" })).toEqual({ reason: "unavailable", retryDays: 7 });
    expect(judgeAttempt({ ...base, outcome: "empty" })).toEqual({ reason: "empty", retryDays: 7 });
  });

  it("kaynakta yeni ilan görüldü ama hiçbiri kaydedilemediyse belirsizdir (tükendi değildir)", () => {
    expect(judgeAttempt({ outcome: "exhausted", added: 0, fresh: 7 })).toEqual({ reason: "unknown", retryDays: 1 });
  });

  it("eklenen ilanlar aile sayısını artırmıyorsa 14 gün bekletir", () => {
    expect(judgeAttempt({ outcome: "satisfied", added: 4, fresh: 4, before: 6, after: 6 })).toEqual({ reason: "mismatch", retryDays: 14 });
    // Yarıdan azı aileye yazıldı.
    expect(judgeAttempt({ outcome: "more", added: 10, fresh: 10, before: 5, after: 8 }).reason).toBe("mismatch");
  });

  it("normal sonuçlar: kademe doldu → beklemez, tükendi → 14 gün, daha fazlası var → 3 gün", () => {
    expect(judgeAttempt({ outcome: "satisfied", added: 5, fresh: 5, before: 0, after: 5 })).toEqual({ reason: "satisfied", retryDays: 0 });
    expect(judgeAttempt({ outcome: "exhausted", added: 3, fresh: 3, before: 2, after: 5 })).toEqual({ reason: "exhausted", retryDays: 14 });
    expect(judgeAttempt({ outcome: "more", added: 20, fresh: 20, before: 0, after: 20 })).toEqual({ reason: "more", retryDays: 3 });
  });

  it("tüm ilanlar zaten bizdeyse (eklenecek yok) tükendi sayılır", () => {
    expect(judgeAttempt({ outcome: "exhausted", added: 0, fresh: 0, before: 20, after: 20 })).toEqual({ reason: "exhausted", retryDays: 14 });
  });
});

describe("reasonLabel", () => {
  it("bilinen gerekçelere Türkçe açıklama verir, bilinmeyene boş", () => {
    expect(reasonLabel("unavailable")).toContain("model sayfası yok");
    expect(reasonLabel(undefined)).toBe("");
  });
});
