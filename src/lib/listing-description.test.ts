import { describe, expect, it } from "vitest";
import { formatListingDescription } from "./listing-description";

describe("ilan açıklaması biçimi", () => {
  it("satır sonlarını ve HTML paragraf aralarını korur", () => {
    expect(formatListingDescription("<p>İlk satır</p><p>İkinci satır<br>devamı</p>")).toBe(
      "İlk satır\n\nİkinci satır\ndevamı"
    );
  });

  it("gereksiz boş satırları ve sıkışık boşlukları düzenler", () => {
    expect(formatListingDescription("  Bakımlı   araç\r\n\r\n\r\n   Takas olur  ")).toBe(
      "Bakımlı araç\n\nTakas olur"
    );
  });

  it("bilinen HTML karakterlerini metin olarak çözer", () => {
    expect(formatListingDescription("Motor &amp; şanzıman &nbsp; kusursuz")).toBe(
      "Motor & şanzıman kusursuz"
    );
  });
});
