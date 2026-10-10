import { describe, expect, it } from "vitest";
import { clampProxyWidth, isProxyableImage, proxiedImageUrl, proxyHostFor } from "./image-proxy";

describe("image-proxy", () => {
  it("yalnızca izinli kaynakları tanır, açık proxy olmaz", () => {
    expect(isProxyableImage("https://dat-tr-prda-ops-vava.azureedge.net/cars/1/a.webp")).toBe(true);
    expect(isProxyableImage("https://images.kavak.services/images/1/a.jpeg")).toBe(true);
    expect(isProxyableImage("https://asset.otomerkezi.net/car-photo/1.jpg")).toBe(true);
    expect(isProxyableImage("https://cdn.otoplus.com/a.jpg")).toBe(true);
    expect(isProxyableImage("https://example.com/a.jpg")).toBe(false);
    expect(isProxyableImage("http://asset.otomerkezi.net/a.jpg")).toBe(false);
    expect(isProxyableImage("file:///etc/passwd")).toBe(false);
    expect(isProxyableImage("https://asset.otomerkezi.net.evil.com/a.jpg")).toBe(false);
    expect(isProxyableImage("not a url")).toBe(false);
    expect(proxyHostFor("https://asset.otomerkezi.net/a.jpg")?.referer).toBe("https://www.otomerkezi.net/");
  });

  it("genişliği sınırlar ve 80 px adımlarına yuvarlar", () => {
    expect(clampProxyWidth(50)).toBe(160);
    expect(clampProxyWidth(5000)).toBe(1280);
    expect(clampProxyWidth(Number.NaN)).toBe(480);
    expect(proxiedImageUrl("https://asset.otomerkezi.net/a.jpg", 470)).toContain("&w=480");
    expect(proxiedImageUrl("https://asset.otomerkezi.net/a.jpg", 300)).toContain("&w=320");
    expect(proxiedImageUrl("https://asset.otomerkezi.net/a.jpg", 480, "https://otopiyasa.app")).toMatch(/^https:\/\/otopiyasa\.app\/api\/img\?u=/);
  });

  it("adımlamayı kendisi yapar: uç noktaya ham w verilse de önbellek anahtarı sınırlı kalır", () => {
    // Eskiden adımlama yalnızca adres üretiminde yapılıyordu; /api/img?w=... çağrısı serbest
    // değerle CDN'i ıskalayıp her seferinde yeni bir küçültme işi başlatıyordu.
    expect(clampProxyWidth(101)).toBe(160);
    expect(clampProxyWidth(161)).toBe(240);
    expect(clampProxyWidth(500)).toBe(560);
    expect(clampProxyWidth(1281)).toBe(1280);
  });

  it("döndürdüğü her değer 80'in katı ve sınırlar içinde", () => {
    for (let raw = -50; raw <= 2000; raw += 7) {
      const width = clampProxyWidth(raw);
      expect(width % 80).toBe(0);
      expect(width).toBeGreaterThanOrEqual(160);
      expect(width).toBeLessThanOrEqual(1280);
    }
  });
});
