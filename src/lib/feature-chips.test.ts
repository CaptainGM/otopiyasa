import { describe, expect, it } from "vitest";
import { featureChips } from "./feature-chips";

describe("featureChips", () => {
  it("bilinmeyeni gizler, bekleyenleri tek etikette toplar", () => {
    expect(featureChips(["Dizel", "Bilinmiyor"])).toEqual([{ label: "Dizel", pending: false }]);
    expect(featureChips(["Doğrulanıyor", "Doğrulanıyor", "Beyaz"])).toEqual([
      { label: "Beyaz", pending: false },
      { label: "Özellikler doğrulanıyor", pending: true },
    ]);
    expect(featureChips(["Belirtilmemiş", undefined])).toEqual([]);
  });
});
