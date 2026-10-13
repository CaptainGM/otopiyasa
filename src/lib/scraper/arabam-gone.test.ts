import { describe, expect, it } from "vitest";
import { arabamNavigationVerdict, promoteRepeatedGone } from "./arabam-gone";

describe("arabamNavigationVerdict", () => {
  it("yönlendirme döngüsü 'engel' değil, zayıf kanıtla 'kaldırılmış' sayılır (tek seferde arşivlenmez)", () => {
    const verdict = arabamNavigationVerdict("page.goto: net::ERR_TOO_MANY_REDIRECTS at https://www.arabam.com/ilan/x");
    expect(verdict.status).toBe("gone");
    expect(verdict.strong).toBe(false);
  });

  it("diğer tarayıcı hataları ilanı korur: engel sayılır, hiçbir şey kanıtlanmaz", () => {
    const verdict = arabamNavigationVerdict("page.goto: net::ERR_CONNECTION_RESET at https://www.arabam.com/ilan/x");
    expect(verdict.status).toBe("blocked");
    expect(verdict.strong).toBeUndefined();
    expect(verdict.reason).toContain("ilan korunur");
  });
});

describe("promoteRepeatedGone", () => {
  const weakGone = { status: "gone" as const, strong: false, reason: "döngü" };

  it("önceki kontrolde bekletilmiş ilan aynı sonucu verirse güçlü kanıta yükselir", () => {
    const promoted = promoteRepeatedGone(weakGone, "gone-held");
    expect(promoted.strong).toBe(true);
    expect(promoted.reason).toContain("İkinci kontrolde de aynı");
  });

  it("ilk kez görülen zayıf kanıt yükselmez (bir kez döngü görmek arşivlemeye yetmez)", () => {
    expect(promoteRepeatedGone(weakGone, undefined).strong).toBe(false);
    expect(promoteRepeatedGone(weakGone, "blocked").strong).toBe(false);
    expect(promoteRepeatedGone(weakGone, null).strong).toBe(false);
  });

  it("güçlü kanıt, canlı ilan ve engel sonuçları olduğu gibi kalır", () => {
    const strong = { status: "gone" as const, strong: true, reason: "kategori" };
    expect(promoteRepeatedGone(strong, "gone-held")).toBe(strong);
    const active = { status: "active" as const, reason: "canlı" };
    expect(promoteRepeatedGone(active, "gone-held")).toBe(active);
    const blocked = { status: "blocked" as const, reason: "engel" };
    expect(promoteRepeatedGone(blocked, "gone-held")).toBe(blocked);
  });
});
