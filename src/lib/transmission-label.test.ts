import { describe, expect, it } from "vitest";
import { AUTOMATIC_TRANSMISSION_PATTERN, displayTransmission } from "./transmission-label";

describe("displayTransmission", () => {
  it("yarı otomatiği otomatik gösterir", () => {
    expect(displayTransmission("Yarı Otomatik")).toBe("Otomatik");
    expect(displayTransmission("yari otomatik")).toBe("Otomatik");
    expect(displayTransmission("YARI OTOMATİK")).toBe("Otomatik");
  });

  it("diğer değerlere dokunmaz", () => {
    expect(displayTransmission("Otomatik")).toBe("Otomatik");
    expect(displayTransmission("Manuel")).toBe("Manuel");
    expect(displayTransmission("Bilinmiyor")).toBe("Bilinmiyor");
    expect(displayTransmission(undefined)).toBeUndefined();
  });
});

describe("AUTOMATIC_TRANSMISSION_PATTERN", () => {
  const re = new RegExp(AUTOMATIC_TRANSMISSION_PATTERN, "i");
  it("otomatik ve yarı otomatiği bulur, manueli bulmaz", () => {
    expect(re.test("Otomatik")).toBe(true);
    expect(re.test("Yarı Otomatik")).toBe(true);
    expect(re.test("Tiptronik")).toBe(true);
    expect(re.test("Manuel")).toBe(false);
  });
});
