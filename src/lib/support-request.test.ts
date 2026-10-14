import { describe, expect, it } from "vitest";
import { parseCarRef, validateRequest } from "./support-request";

const base = {
  consent: true,
  type: "sikayet",
  subject: "Yanlış fiyat",
  message: "Bu ilanın fiyatı gerçekle uyuşmuyor, lütfen kontrol edin.",
  email: "ali@example.com",
};

describe("validateRequest", () => {
  it("geçerli bir talebi kabul eder ve e-postayı küçük harfe çevirir", () => {
    const result = validateRequest({ ...base, email: " Ali@Example.COM " }, { loggedIn: false });
    expect(result).toEqual({
      ok: true,
      value: {
        spam: false,
        type: "sikayet",
        subject: "Yanlış fiyat",
        message: base.message,
        email: "ali@example.com",
        name: "",
        carId: null,
      },
    });
  });

  it("gizli alan doluysa bot sayar: hata vermez, kayıt yapılmaz", () => {
    expect(validateRequest({ ...base, website: "http://spam.example" }, { loggedIn: false })).toEqual({
      ok: true,
      value: { spam: true },
    });
  });

  it("onay kutusu işaretli değilse reddeder", () => {
    expect(validateRequest({ ...base, consent: false }, { loggedIn: true }).ok).toBe(false);
  });

  it("bilinmeyen talep türünü reddeder", () => {
    expect(validateRequest({ ...base, type: "baska" }, { loggedIn: true }).ok).toBe(false);
  });

  it("konu ve mesaj sınırlarını uygular", () => {
    expect(validateRequest({ ...base, subject: "ab" }, { loggedIn: true }).ok).toBe(false);
    expect(validateRequest({ ...base, subject: "a".repeat(121) }, { loggedIn: true }).ok).toBe(false);
    expect(validateRequest({ ...base, message: "kısa" }, { loggedIn: true }).ok).toBe(false);
    expect(validateRequest({ ...base, message: "a".repeat(2001) }, { loggedIn: true }).ok).toBe(false);
    expect(validateRequest({ ...base, message: "a".repeat(10) }, { loggedIn: true }).ok).toBe(true);
  });

  it("giriş yapılmadıysa e-posta zorunlu, giriş yapılmışsa isteğe bağlı", () => {
    expect(validateRequest({ ...base, email: "" }, { loggedIn: false }).ok).toBe(false);
    expect(validateRequest({ ...base, email: "" }, { loggedIn: true }).ok).toBe(true);
  });

  it("e-posta biçimini denetler", () => {
    expect(validateRequest({ ...base, email: "ali@" }, { loggedIn: true }).ok).toBe(false);
  });

  it("ilgili ilan geçersizse reddeder, geçerliyse kimliğini taşır", () => {
    expect(validateRequest({ ...base, carRef: "bu bir ilan değil" }, { loggedIn: true }).ok).toBe(false);
    const result = validateRequest(
      { ...base, carRef: "https://otopiyasa.app/cars/6a60ec996701548eb7a8ad27?x=1" },
      { loggedIn: true }
    );
    expect(result.ok && !result.value.spam && result.value.carId).toBe("6a60ec996701548eb7a8ad27");
  });
});

describe("parseCarRef", () => {
  it("boş, kimlik ve ilan bağlantısını ayırt eder", () => {
    expect(parseCarRef("")).toBeNull();
    expect(parseCarRef("6A60EC996701548EB7A8AD27")).toBe("6a60ec996701548eb7a8ad27");
    expect(parseCarRef("https://otopiyasa.app/cars/6a60ec996701548eb7a8ad27")).toBe("6a60ec996701548eb7a8ad27");
    expect(parseCarRef("https://otopiyasa.app/cars/kisa")).toBe("invalid");
  });
});
