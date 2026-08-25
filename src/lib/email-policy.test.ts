import { describe, expect, it } from "vitest";
import { canonicalEmail, emailDomain, isDisposableEmail } from "./email-policy";

describe("isDisposableEmail", () => {
  it("bilinen geçici sağlayıcıları yakalar", () => {
    expect(isDisposableEmail("test@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@10minutemail.com")).toBe(true);
    expect(isDisposableEmail("x@YOPMAIL.COM")).toBe(true); 
  });

  it("alt alan adlarını da yakalar", () => {
    expect(isDisposableEmail("a@foo.mailinator.com")).toBe(true);
  });

  it("gerçek sağlayıcılara dokunmaz", () => {
    expect(isDisposableEmail("kullanici@gmail.com")).toBe(false);
    expect(isDisposableEmail("ogrenci@ogr.uni.edu.tr")).toBe(false);
  
    expect(isDisposableEmail("a@notmailinator.com")).toBe(false);
  });

  it("bozuk girdide çökmez", () => {
    expect(isDisposableEmail("adres-degil")).toBe(false);
    expect(emailDomain("adres-degil")).toBeNull();
  });
});

describe("canonicalEmail", () => {
  it("Gmail nokta ve +etiket hilelerini normalize eder", () => {
    const base = canonicalEmail("ali.veli@gmail.com");
    expect(canonicalEmail("aliveli@gmail.com")).toBe(base);
    expect(canonicalEmail("ali.veli+test1@gmail.com")).toBe(base);
    expect(canonicalEmail("A.L.I.veli+x@GMAIL.com")).toBe(base);
  });

  it("googlemail.com da aynı kutudur", () => {
    expect(canonicalEmail("a.b@googlemail.com")).toBe("ab@googlemail.com");
  });

  it("Gmail dışında noktalar korunur (farklı kutular)", () => {
    expect(canonicalEmail("a.b@outlook.com")).toBe("a.b@outlook.com");
    expect(canonicalEmail("ab@outlook.com")).not.toBe(canonicalEmail("a.b@outlook.com"));
  });

  it("+etiket her sağlayıcıda temizlenir", () => {
    expect(canonicalEmail("user+spam@outlook.com")).toBe("user@outlook.com");
  });
});
