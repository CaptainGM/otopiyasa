import { describe, expect, it } from "vitest";
import { GALLERY_REQUIRED_SOURCES, incompleteReason, isIncompleteRemoval, lacksGallery } from "./listing-quality";

describe("galeri şartı", () => {
  it("galeri şartı olan kaynakta en fazla bir fotoğraflı ilanı eksik sayar", () => {
    for (const source of GALLERY_REQUIRED_SOURCES) {
      expect(lacksGallery(source, [])).toBe(true);
      expect(lacksGallery(source, ["a.jpg"])).toBe(true);
      expect(lacksGallery(source, undefined)).toBe(true);
      expect(lacksGallery(source, ["a.jpg", "b.jpg"])).toBe(false);
    }
  });

  it("diğer kaynaklara ve kullanıcı ilanlarına dokunmaz", () => {
    expect(lacksGallery("arabam", ["a.jpg"])).toBe(false);
    expect(lacksGallery("otokoc", [])).toBe(false);
    expect(lacksGallery("user", undefined)).toBe(false);
    expect(lacksGallery(undefined, [])).toBe(false);
  });

  it("eksik diye arşive alınanı satıldığı için arşive alınandan ayırır", () => {
    expect(isIncompleteRemoval(incompleteReason("dod"))).toBe(true);
    expect(isIncompleteRemoval("dod: ilan sayfası kaldırılmış")).toBe(false);
    expect(isIncompleteRemoval(undefined)).toBe(false);
  });
});
