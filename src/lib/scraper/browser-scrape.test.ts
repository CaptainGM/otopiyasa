import { describe, it, expect } from "vitest";
import { isCloudflareChallenge, isListingGone, normalizeArabamGallery } from "./browser-scrape";

describe("isListingGone", () => {
  it("detects search redirect URLs as gone", () => {
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el/otomobil")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el?searchText=bmw")).toBe(true);
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ilan/ford-fiesta/123456")).toBe(false);
    // Kaldırılan ilan model kategorisine yönlenir (canlı sitede ölçüldü)
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/ikinci-el/otomobil/peugeot-206-1-4-fever")).toBe(true);
  });

  it("does not treat a redirect to the home page as proof of removal", () => {
    // Bot/bölge filtresi de ana sayfaya yönlendirir; bu ilanı öldürmemeli.
    expect(isListingGone("<html>...</html>", "https://www.arabam.com/")).toBe(false);
    expect(isListingGone("<html>...</html>", "https://tr.vava.cars/")).toBe(false);
  });
});

describe("isCloudflareChallenge", () => {
  it("recognises the Cloudflare interstitial", () => {
    expect(isCloudflareChallenge('<!DOCTYPE html><html><head><title>Just a moment...</title>')).toBe(true);
    expect(isCloudflareChallenge('<script src="https://challenges.cloudflare.com/turnstile"></script>')).toBe(true);
    expect(isCloudflareChallenge("<html><head><title>Sahibinden BMW 3 Serisi</title></head></html>")).toBe(false);
    expect(isCloudflareChallenge("")).toBe(false);
  });

  it("detects error text in HTML as gone", () => {
    expect(isListingGone("<div>Böyle bir ilan bulunamadı</div>")).toBe(true);
    expect(isListingGone("<div>İlan yayından kaldırılmıştır</div>")).toBe(true);
    expect(isListingGone("<div>Aradığınız ilan bulunamamıştır</div>")).toBe(true);
    expect(isListingGone("<div>Sahibinden 2022 Ford Focus Sahibinden Satılık</div>")).toBe(false);
  });
});

describe("normalizeArabamGallery", () => {
  const photo = (uuid: string, size: string, id = "42188516") =>
    `https://arbstorage.mncdn.com/ilanfotograflari/2026/07/19/${id}/${uuid}_image_for_silan_${id}_${size}.jpg`;

  it("keeps one entry per photo even when the page lists several sizes", () => {
    const out = normalizeArabamGallery(
      [photo("a", "120x90"), photo("a", "800x600"), photo("b", "800x600"), photo("a", "1920x1080"), photo("b", "580x435")],
      "42188516"
    );
    expect(out).toEqual([photo("a", "1920x1080"), photo("b", "1920x1080")]);
  });

  it("drops photos of other listings, placeholders and escaped leftovers", () => {
    const out = normalizeArabamGallery(
      [
        photo("a", "800x600"),
        photo("z", "800x600", "40000001"),
        "https://arbimg1.mncdn.com/ilanfotograflari/noImage/01/01/1/noimage5_120x90.jpg",
        photo("b", "120x90") + "\'",
        photo("a", "{0}"),
        photo("c", "{0}"),
      ],
      "42188516"
    );
    // Şablon adresi ("_{0}") boyutla tamamlanır; aynı fotoğrafın gerçek adresi varsa tekilleşir.
    expect(out).toEqual([photo("a", "1920x1080"), photo("b", "1920x1080"), photo("c", "1920x1080")]);
  });

  it("falls back to every photo when none carries the listing number", () => {
    expect(normalizeArabamGallery([photo("a", "800x600", "1")], "42188516")).toEqual([photo("a", "1920x1080", "1")]);
  });
});

describe("parseArabamDetailHtml etiket yazımı", () => {
  const page = (labels: { vites: string; yakit: string; kasa: string }) => `<html><body>
    <script type="application/ld+json">${JSON.stringify({
      "@type": "Car",
      brand: "Seat",
      model: "1.6 TDI Ecomotive Xcellence",
      name: "Seat Ateca 1.6 TDI Xcellence | Arabam",
      vehicleTransmission: "Otomatik",
      color: "Beyaz",
      productionDate: 2020,
      mileageFromOdometer: { value: 101000 },
      offers: { price: 1325000 },
    })}</script>
    <div class="property-item">${labels.vites}</div>
    <div class="property-item">${labels.yakit}</div>
    <div class="property-item">${labels.kasa}</div>
    <div class="property-item">Renk Beyaz</div>
    <div class="property-item">Çekiş Önden Çekiş</div>
  </body></html>`;

  it("sitenin güncel küçük harfli etiketlerini (Vites tipi / Kasa tipi) okur", async () => {
    const { parseArabamDetailHtml } = await import("./browser-scrape");
    const listing = parseArabamDetailHtml(
      page({ vites: "Vites tipi Otomatik", yakit: "Yakıt tipi Dizel", kasa: "Kasa tipi SUV" }),
      "https://www.arabam.com/ilan/seat-ateca/41921782"
    );
    expect(listing?.features.transmission).toBe("Otomatik");
    expect(listing?.features.fuelType).toBe("Dizel");
    expect(listing?.features.bodyType).toBe("SUV");
    expect(listing?.confirmedFeatures).toEqual(expect.arrayContaining(["transmission", "fuelType", "bodyType", "color"]));
  });

  it("eski büyük harfli etiketleri de okur", async () => {
    const { parseArabamDetailHtml } = await import("./browser-scrape");
    const listing = parseArabamDetailHtml(
      page({ vites: "Vites Tipi Otomatik", yakit: "Yakıt Tipi Dizel", kasa: "Kasa Tipi Sedan" }),
      "https://www.arabam.com/ilan/seat-ateca/41921782"
    );
    expect(listing?.features.bodyType).toBe("Sedan");
    expect(listing?.confirmedFeatures).toContain("bodyType");
  });

  it("sayfada yazmayan yakıt/kasa tahmin sayılır, doğrulanmış işaretlenmez", async () => {
    const { parseArabamDetailHtml } = await import("./browser-scrape");
    const listing = parseArabamDetailHtml(
      "<html><body><script type=\"application/ld+json\">" +
        JSON.stringify({ "@type": "Car", brand: "Seat", model: "Ateca", name: "Seat Ateca", offers: { price: 1000000 } }) +
        "</script></body></html>",
      "https://www.arabam.com/ilan/seat-ateca/41921782"
    );
    expect(listing?.confirmedFeatures).not.toContain("bodyType");
    expect(listing?.confirmedFeatures).not.toContain("fuelType");
  });
});
