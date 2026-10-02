import { describe, it, expect } from "vitest";
import { classifyTramer, mergeDetailIntoListing, parseOtokocDetail, parseOtoplusDetail, shouldReplaceFuel } from "./enrich-detail";
import type { ScrapedListing } from "./types";

const otokocHtml = (opts: { tramer?: string; paint?: string; images?: string[]; fuel?: string; volume?: string } = {}) => {
  const images = opts.images ?? [
    "https://2el-cdn.otokoc.com.tr/otokoc2el/car/450x/a1.webp",
    "https://2el-cdn.otokoc.com.tr/otokoc2el/car/450x/a2.webp",
    "https://2el-cdn.otokoc.com.tr/otokoc2el/car/450x/a3.webp",
  ];
  const ld = {
    "@type": "Car",
    name: "RENAULT CLIO EVOLUTION 2021 | Otokoç 2. El",
    image: images,
    color: "Beyaz",
    bodyType: "Hatchback",
    vehicleTransmission: "Otomatik",
    vehicleEngine: { fuelType: opts.fuel ?? "Benzin" },
    mileageFromOdometer: { value: 41250 },
  };
  // RSC yükü kaçışlı JSON içerir
  const rsc = `\\"tramerRecords\\":\\"${opts.tramer ?? "SORGU TARİHİ: TRAMER KAYDI YOKTUR."}\\",\\"engineVolume\\":\\"${opts.volume ?? "1.0"}\\"`;
  const paint = opts.paint ?? "Araçta boya veya değişen parça kaydı bulunmamaktadır. Tüm parçalar orijinaldir.";
  return `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>
    <script>self.__next_f.push([1,"${rsc}"])</script>
    <div class="status-box-module__AbC123__box"><p class="status-box-module__AbC123__description">${paint}</p></div></body></html>`;
};

describe("parseOtokocDetail", () => {
  it("tüm fotoğrafları 640x'e yükseltip renk, kasa, motor hacmi ve açıklamayı çıkarır", () => {
    const p = parseOtokocDetail(otokocHtml())!;
    expect(p.images).toHaveLength(3);
    expect(p.images![0]).toBe("https://2el-cdn.otokoc.com.tr/otokoc2el/car/640x/a1.webp");
    expect(p.color).toBe("Beyaz");
    expect(p.bodyType).toBe("Hatchback");
    expect(p.engineSize).toBe(1);
    expect(p.damageFlag).toBe(false);
    expect(p.paintChange).toContain("Boya/değişen yok");
    expect(p.description).toContain("RENAULT CLIO EVOLUTION 2021");
    expect(p.description).toContain("41.250 km");
    expect(p.description).toContain("Tramer sorgusunda hasar kaydı bulunmuyor");
    expect(p.description).not.toContain("| Otokoç");
  });

  it("tramer kaydı varsa hasarlı işaretler ve açıklamaya yazar", () => {
    const p = parseOtokocDetail(otokocHtml({ tramer: "SORGU TARİHİ:13.04.2026 15.04.2025:ERP-ÇARPMA:11.000TL" }))!;
    expect(p.damageFlag).toBe(true);
    expect(p.description).toContain("Tramer kaydı:");
    expect(p.description).toContain("11.000TL");
  });

  it("tramer sorgulanamadıysa hasar hakkında hüküm vermez", () => {
    const p = parseOtokocDetail(otokocHtml({ tramer: "Tramer kaydı teknik bir sebepten dolayı sorgulanamamıştır." }))!;
    expect(p.damageFlag).toBeUndefined();
    expect(p.description).not.toContain("Tramer");
  });

  it("elektrikli araçta güvenilmez motor hacmini almaz", () => {
    expect(parseOtokocDetail(otokocHtml({ fuel: "Elektrik", volume: "1.2" }))!.engineSize).toBeUndefined();
  });

  it("ilan verisi olmayan sayfada (soft 404) null döner", () => {
    expect(parseOtokocDetail("<html><h1>404 | Sayfa Bulunamadı</h1></html>")).toBeNull();
  });
});

describe("classifyTramer", () => {
  it("gerçek ilanlarda görülen 'kayıt yok' biçimlerini tanır", () => {
    for (const raw of [
      "SORGU TARİHİ: TRAMER KAYDI YOKTUR.",
      "SORGU TARİHİ: TRAMER YOK",
      "SORGU TARİHİ: YOK",
      "SORGU TARİHİ:11.03.2026\n\nHASAR KAYDI YOK.",
      "SORGU TARİHİ: 2026-08-29 >>> Aracın SBM kayıtlarında geçmiş hasarı bulunamamıştır.",
    ]) {
      expect(classifyTramer(raw).status, raw).toBe("none");
    }
  });

  it("hasar/tramer kayıtlarını tanır", () => {
    for (const raw of [
      "SORGU TARİHİ:  TRAMER 2 ADET ; 36.409 TL",
      "SORGU TARİHİ:13.04.2026\n\n15.04.2025:ERP-ÇARPMA:11.000TL",
      "SORGU TARİHİ: 02.04.2026:32.000 TL",
      "SORGU TARİHİ: 16.12.2025  ÇARPMA   TUTARSIZ",
    ]) {
      expect(classifyTramer(raw).status, raw).toBe("record");
    }
  });

  it("sorgulanamayan ya da boş değeri bilinmiyor sayar", () => {
    expect(classifyTramer("Tramer kaydı teknik bir sebepten dolayı sorgulanamamıştır.").status).toBe("unknown");
    expect(classifyTramer("undefined").status).toBe("unknown");
    expect(classifyTramer("").status).toBe("unknown");
  });
});

describe("parseOtoplusDetail", () => {
  it("galeri, açıklama ve rengi ld+json'dan alır", () => {
    const ld = {
      "@type": "Car",
      description: "Galeriden Fiat DOBLO 2022 Model otomobil ilanı. 96.333 km, Gri, boyasız.",
      color: "Gri",
      image: ["https://cdn.otoplus.com/a_1920x1080.jpg", "https://cdn.otoplus.com/b_1920x1080.jpg"],
    };
    const p = parseOtoplusDetail(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`)!;
    expect(p.images).toHaveLength(2);
    expect(p.color).toBe("Gri");
    expect(p.paintChange).toBe("Boyasız");
    expect(p.description).toContain("Otoplus ekspertizli araç");
  });
});

describe("mergeDetailIntoListing", () => {
  const base: ScrapedListing = {
    externalId: "otokoc-1",
    sourceSite: "otokoc",
    listingUrl: "https://www.otokocikinciel.com/ilan/x",
    title: "Renault CLIO 2021",
    brand: "Renault",
    model: "CLIO",
    year: 2021,
    price: 900000,
    mileage: 41250,
    city: "İstanbul",
    description: "şablon açıklama",
    imageUrl: "https://cdn/1.webp",
    images: ["https://cdn/1.webp"],
    features: { fuelType: "Benzin", transmission: "Otomatik", bodyType: "Belirtilmemiş", color: "Beyaz" },
  };

  it("daha zengin galeriyi ve bilinmeyen alanları doldurur, bilinenleri ezmez", () => {
    const merged = mergeDetailIntoListing(base, {
      images: ["https://cdn/1.webp", "https://cdn/2.webp", "https://cdn/3.webp"],
      description: "detaylı açıklama",
      bodyType: "Hatchback",
      color: "Siyah",
      damageFlag: false,
    });
    expect(merged.images).toHaveLength(3);
    expect(merged.description).toBe("detaylı açıklama");
    expect(merged.features.bodyType).toBe("Hatchback");
    expect(merged.features.color).toBe("Beyaz"); // listedeki bilinen değer korunur
    expect(merged.damageFlag).toBe(false);
  });

  it("daha az fotoğraf gelirse mevcut galeriyi küçültmez", () => {
    const merged = mergeDetailIntoListing({ ...base, images: ["a", "b", "c"] }, { images: ["a"] });
    expect(merged.images).toEqual(["a", "b", "c"]);
  });
});

describe("shouldReplaceFuel", () => {
  it("liste tahminini aracın kendi kaydıyla düzeltir", () => {
    // "RANGE ROVER EVOQUE" ve "QASHQAI 1.3DIG-T MHEV" liste açıklamasından elektrikli sanılıyordu.
    expect(shouldReplaceFuel("Elektrik", "Kurşunsuz")).toBe(true);
    expect(shouldReplaceFuel("Elektrik", "Hibrit")).toBe(true);
    expect(shouldReplaceFuel("Bilinmiyor", "Dizel")).toBe(true);
    expect(shouldReplaceFuel("Kurşunsuz", "Benzin")).toBe(true);
  });

  it("aynı yakıtı, sonradan takılan LPG'yi ve anlaşılmayan değeri ezmez", () => {
    expect(shouldReplaceFuel("Benzin", "Kurşunsuz")).toBe(false);
    expect(shouldReplaceFuel("LPG & Benzin", "Benzin")).toBe(false);
    expect(shouldReplaceFuel("Dizel", "Hidrojen")).toBe(false);
    expect(shouldReplaceFuel("Dizel", "")).toBe(false);
    expect(shouldReplaceFuel("Dizel", "Bilinmiyor")).toBe(false);
  });
});
