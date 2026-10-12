import { describe, expect, it } from "vitest";
import { normalizeBrandModel } from "@/lib/normalize-brand";

// Arabam, satıcı türünü ("Galeriden", "Sahibinden") marka alanına yazabiliyor; model ise kategori olur.
describe("normalizeBrandModel: satıcı türü marka alanına düştüğünde", () => {
  it("kategoriden marka türetir ve modeli olduğu gibi bırakır", () => {
    expect(normalizeBrandModel("Galeriden", "Karavan Motokaravan")).toEqual({ brand: "Karavan", model: "Karavan Motokaravan" });
    expect(normalizeBrandModel("Sahibinden", "Ticari Araçlar")).toEqual({ brand: "Ticari Araç", model: "Ticari Araçlar" });
    expect(normalizeBrandModel("Sahibinden", "Elektrikli Araçlar")).toEqual({ brand: "Elektrikli Araç", model: "Elektrikli Araçlar" });
  });

  it("kategori tanınmazsa marka bilinmiyor olur (mevcut marka ezilmez, yeni kayıt eklenmez)", () => {
    expect(normalizeBrandModel("Galeriden", "Bilinmeyen Kategori")).toEqual({ brand: "Bilinmiyor", model: "Bilinmeyen Kategori" });
  });

  it("gerçek markaya dokunmaz", () => {
    expect(normalizeBrandModel("Toyota", "Corolla").brand).toBe("Toyota");
    expect(normalizeBrandModel("Galeriden Toyota", "Corolla").brand).toBe("Galeriden Toyota");
  });
});
