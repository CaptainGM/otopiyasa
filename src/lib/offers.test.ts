import { describe, expect, it } from "vitest";
import {
  validateOfferAmount,
  validateMinOffer,
  effectiveOfferFloor,
  effectiveStatus,
  canSendMessage,
  canSubmitNewOffer,
  canRespond,
  chatExpiryFrom,
  remainingMs,
  formatRemaining,
  OFFER_CHAT_WINDOW_MS,
  MIN_OFFER_PRICE,
} from "@/lib/offers";

const LISTING = 1_000_000;

describe("validateOfferAmount", () => {
  it("makul teklifi kabul eder", () => {
    expect(validateOfferAmount(900_000, LISTING).valid).toBe(true);
    expect(validateOfferAmount(1_000_000, LISTING).valid).toBe(true);
  });

  it("şaka tekliflerini eler", () => {
    expect(validateOfferAmount(1, LISTING).valid).toBe(false);
    expect(validateOfferAmount(0, LISTING).valid).toBe(false);
    expect(validateOfferAmount(-500_000, LISTING).valid).toBe(false);
  });

  it("mutlak tabanın altını eler", () => {
    expect(validateOfferAmount(MIN_OFFER_PRICE - 1, 0).valid).toBe(false);
    expect(validateOfferAmount(MIN_OFFER_PRICE, 0).valid).toBe(true);
  });

  it("ilan fiyatına göre çok düşük teklifi eler (%30 taban)", () => {
    expect(validateOfferAmount(250_000, LISTING).valid).toBe(false);
    expect(validateOfferAmount(300_000, LISTING).valid).toBe(true);
  });

  it("saçma yüksek teklifi eler", () => {
    expect(validateOfferAmount(5_000_000, LISTING).valid).toBe(false);
  });

  it("ondalık tutarı reddeder", () => {
    expect(validateOfferAmount(900_000.5, LISTING).valid).toBe(false);
  });
});

describe("satıcının belirlediği minimum teklif", () => {
  it("satıcı taban koyduysa onun sözü geçer (%30 kuralını ezer)", () => {
    
    expect(validateOfferAmount(500_000, LISTING, 600_000).valid).toBe(false);
    expect(validateOfferAmount(600_000, LISTING, 600_000).valid).toBe(true);
  });

  it("satıcı %30'un ALTINDA bir taban koyabilir (kendi aracı, kendi kararı)", () => {
   
    expect(validateOfferAmount(150_000, LISTING, 150_000).valid).toBe(true);
    expect(validateOfferAmount(149_999, LISTING, 150_000).valid).toBe(false);
  });

  it("mutlak taban her hâlükârda korunur", () => {

    expect(effectiveOfferFloor(LISTING, 5)).toBe(MIN_OFFER_PRICE);
    expect(validateOfferAmount(5, LISTING, 5).valid).toBe(false);
  });

  it("taban belirtilmezse sistem varsayılanına düşer", () => {
    expect(effectiveOfferFloor(LISTING, 0)).toBe(300_000);
    expect(effectiveOfferFloor(LISTING, null)).toBe(300_000);
    expect(effectiveOfferFloor(LISTING, undefined)).toBe(300_000);
  });

  it("hata mesajı satıcı tabanını açıkça söyler", () => {
    const res = validateOfferAmount(400_000, LISTING, 600_000);
    expect(res.error).toContain("Satıcı");
    expect(res.error).toContain("600.000");
  });
});

describe("validateMinOffer (ilan verirken)", () => {
  it("boş bırakmak serbest", () => {
    expect(validateMinOffer(0, LISTING).valid).toBe(true);
  });

  it("makul değeri kabul eder", () => {
    expect(validateMinOffer(800_000, LISTING).valid).toBe(true);
    expect(validateMinOffer(LISTING, LISTING).valid).toBe(true); // pazarlık yok
  });

  it("ilan fiyatından yüksek olamaz", () => {
    expect(validateMinOffer(1_200_000, LISTING).valid).toBe(false);
  });

  it("mutlak tabanın altında olamaz", () => {
    expect(validateMinOffer(1_000, LISTING).valid).toBe(false);
  });

  it("ondalık/negatif değeri reddeder", () => {
    expect(validateMinOffer(500_000.5, LISTING).valid).toBe(false);
    expect(validateMinOffer(-100, LISTING).valid).toBe(false);
  });
});

describe("48 saatlik pencere", () => {
  const accepted = new Date("2026-07-28T12:00:00Z");
  const expires = chatExpiryFrom(accepted);

  it("kabulden 48 saat sonrasını işaretler", () => {
    expect(expires.getTime() - accepted.getTime()).toBe(OFFER_CHAT_WINDOW_MS);
  });

  it("pencere içinde sohbet açık", () => {
    const t = new Date(accepted.getTime() + 47 * 60 * 60 * 1000);
    expect(effectiveStatus("accepted", expires, t)).toBe("accepted");
    expect(canSendMessage("accepted", expires, t)).toBe(true);
  });

  it("pencere dolunca kanal kendiliğinden kapanır (görev gerekmez)", () => {
    const t = new Date(accepted.getTime() + 49 * 60 * 60 * 1000);
    expect(effectiveStatus("accepted", expires, t)).toBe("expired");
    expect(canSendMessage("accepted", expires, t)).toBe(false);
  });

  it("kalan süreyi okunabilir verir", () => {
    const t = new Date(accepted.getTime() + 46 * 60 * 60 * 1000);
    expect(formatRemaining(remainingMs("accepted", expires, t)!)).toBe("2 saat");
  });
});

describe("kim ne yapabilir", () => {
  it("bekleyen teklifte satıcı yanıtlar, alıcı yeni teklif veremez", () => {
    expect(canRespond("pending", null)).toBe(true);
    expect(canSubmitNewOffer("pending", null)).toBe(false);
    expect(canSendMessage("pending", null)).toBe(false);
  });

  it("reddedilince alıcı YENİ teklif verebilir ama sohbet açılmaz", () => {
    expect(canSubmitNewOffer("rejected", null)).toBe(true);
    expect(canSendMessage("rejected", null)).toBe(false);
    expect(canRespond("rejected", null)).toBe(false);
  });

  it("kabul edilince sohbet açılır, yeni teklif verilemez", () => {
    const future = new Date(Date.now() + OFFER_CHAT_WINDOW_MS);
    expect(canSendMessage("accepted", future)).toBe(true);
    expect(canSubmitNewOffer("accepted", future)).toBe(false);
    expect(canRespond("accepted", future)).toBe(false);
  });

  it("süresi dolan kanalda yeniden teklif verilebilir", () => {
    const past = new Date(Date.now() - 1000);
    expect(canSubmitNewOffer("accepted", past)).toBe(true);
    expect(canSendMessage("accepted", past)).toBe(false);
  });
});
