import { afterEach, describe, expect, it } from "vitest";
import { absolutePushUrl } from "./push-url";

const previous = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previous;
});

describe("absolutePushUrl", () => {
  it("göreli ilan yolunu tam adrese çevirir (mobil bağlantıyı böyle açabilir)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://otopiyasa.app";
    expect(absolutePushUrl("/cars/65f1a2b3c4d5e6f701234567")).toBe(
      "https://otopiyasa.app/cars/65f1a2b3c4d5e6f701234567"
    );
  });

  it("eğik çizgisiz yolu da kabul eder", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://otopiyasa.app";
    expect(absolutePushUrl("cars/abc")).toBe("https://otopiyasa.app/cars/abc");
  });

  it("zaten mutlak olan adrese dokunmaz", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://otopiyasa.app";
    expect(absolutePushUrl("https://otopiyasa.app/cars/x")).toBe("https://otopiyasa.app/cars/x");
    expect(absolutePushUrl("otopiyasa://cars/x")).toBe("otopiyasa://cars/x");
  });

  it("adres yoksa undefined döner", () => {
    expect(absolutePushUrl(undefined)).toBeUndefined();
    expect(absolutePushUrl("")).toBeUndefined();
  });

  it("ortam değişkenindeki sondaki eğik çizgiyi tekrarlamaz", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://otopiyasa.app/";
    expect(absolutePushUrl("/admin")).toBe("https://otopiyasa.app/admin");
  });
});
