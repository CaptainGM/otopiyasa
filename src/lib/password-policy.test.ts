import { describe, expect, it } from "vitest";
import { checkPassword, passwordError, PASSWORD_MIN_LENGTH } from "./password-policy";

describe("checkPassword", () => {
  it("tüm kuralları sağlayan şifreyi kabul eder", () => {
    expect(checkPassword("Otopiyasa1!").valid).toBe(true);
    expect(passwordError("Otopiyasa1!")).toBeNull();
  });

  it.each([
    ["Ab1!", "kısa"],
    ["otopiyasa1!", "büyük harf yok"],
    ["OTOPIYASA1!", "küçük harf yok"],
    ["Otopiyasaa!", "rakam yok"],
    ["Otopiyasa11", "özel karakter yok"],
  ])("%s reddedilir (%s)", (password) => {
    expect(checkPassword(password).valid).toBe(false);
    expect(passwordError(password)).toContain("Eksikler");
  });

  it("eksik kuralları tek tek bildirir", () => {
    const { failed } = checkPassword("abc");
    expect(failed).toHaveLength(4); 
    expect(failed.some((f) => f.includes(String(PASSWORD_MIN_LENGTH)))).toBe(true);
  });

  it("Türkçe harfleri doğru sınıflandırır", () => {
  
    expect(checkPassword("şifreĞüç1!").valid).toBe(true);
    
    expect(checkPassword("ŞİFREĞÜÇ1!").results.find((r) => r.id === "lower")?.ok).toBe(false);
  });

  it("özel karakter kontrolü harf/rakamı özel saymaz", () => {
    const results = checkPassword("Abcdefg1").results;
    expect(results.find((r) => r.id === "special")?.ok).toBe(false);
  });

  it("string olmayan girdide çökmez", () => {
    expect(checkPassword(undefined).valid).toBe(false);
    expect(checkPassword(null).valid).toBe(false);
    expect(checkPassword(12345678).valid).toBe(false);
  });
});
