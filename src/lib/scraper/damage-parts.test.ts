import { describe, expect, it } from "vitest";
import { extractArabamDamageParts } from "@/lib/scraper/browser-scrape";

/**
 * Girdiler gerçek Arabam detay sayfasından alındı (canlı fetch ile
 * doğrulandı): her parça bir <path> ve durumu `uib-tooltip` özniteliğinde,
 * adı da <title> içinde duruyor.
 */
const REAL = `
<svg>
  <path d="m1 2" fill="#E9E9E9" id="B01001" uib-tooltip="Boyanmış" tooltip-append-to-body="true" >
    <title>Motor Kaputu</title>
  </path>
  <path d="m3 4" fill="#fff" id="B0201" uib-tooltip="Orijinal" >
    <title>Sağ Arka Çamurluk</title>
  </path>
  <path d="m5 6" id="B0301" uib-tooltip="Değişmiş"><title>Ön Tampon</title></path>
  <path d="m7 8" id="B0401" uib-tooltip="Belirtilmemiş"><title>Tavan</title></path>
</svg>`;

describe("extractArabamDamageParts", () => {
  it("parça adı ve durumunu birlikte çıkarır", () => {
    const parts = extractArabamDamageParts(REAL);
    expect(parts).toHaveLength(4);
    expect(parts[0]).toEqual({ name: "Motor Kaputu", state: "Boyanmış" });
    expect(parts[2]).toEqual({ name: "Ön Tampon", state: "Değişmiş" });
  });

  it("aynı parça iki kez çizilmişse tekrar etmez", () => {
    const parts = extractArabamDamageParts(REAL + REAL);
    expect(parts).toHaveLength(4);
  });

  /**
   * ÖLÇÜLDÜ: bazı ilanlarda şema hiç yok, bazılarında 6, bazılarında 13 parça
   * çıkıyor. Bulunamaması hata değil — arayüz özet görünümüne düşer.
   */
  it("şema yoksa boş dizi döner (hata değil)", () => {
    expect(extractArabamDamageParts("<html><body>şema yok</body></html>")).toEqual([]);
    expect(extractArabamDamageParts("")).toEqual([]);
  });

  it("boş ad/durum atlanır", () => {
    const html = `<path uib-tooltip=""><title>Kaput</title></path>
                  <path uib-tooltip="Orijinal"><title>  </title></path>`;
    expect(extractArabamDamageParts(html)).toEqual([]);
  });
});
