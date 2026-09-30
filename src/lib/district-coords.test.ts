import { describe, it, expect } from "vitest";
import { placeListing, resolvePlacement } from "./district-coords";

describe("placeListing", () => {
  it("adreste ilçe geçiyorsa o ilçenin merkezine koyar (Kadıköy)", () => {
    const p = placeListing("İstanbul", "Hasanpaşa Mh. Kadıköy, İstanbul", 0);
    expect(p).not.toBeNull();
   
    expect(p!.lat).toBeGreaterThan(40.95);
    expect(p!.lat).toBeLessThan(41.02);
    expect(p!.lng).toBeGreaterThan(29.0);
    expect(p!.lng).toBeLessThan(29.12);
  });

  it("farklı ilçe = farklı konum (Küçükçekmece batıda, Kadıköy'den ayrı)", () => {
    const kadikoy = placeListing("İstanbul", "X Mh. Kadıköy, İstanbul", 0)!;
    const kck = placeListing("İstanbul", "Y Mh. Küçükçekmece, İstanbul", 0)!;
    expect(kck.lng).toBeLessThan(kadikoy.lng - 0.1); // Küçükçekmece belirgin biçimde batıda
  });

  it("ilçe bilgisi yoksa (sadece il) il merkezine yakın koyar", () => {
    const p = placeListing("İstanbul", "", 5)!;
    expect(Math.abs(p.lat - 41.0082)).toBeLessThan(0.02);
    expect(Math.abs(p.lng - 28.9784)).toBeLessThan(0.02);
  });

  it("başka ilin adresindeki ilçe adını KENDİ iline yansıtmaz (Ankara'daki 'Kadıköy' → İstanbul değil)", () => {
    const p = placeListing("Ankara", "Kadıköy Mah. Çankaya, Ankara", 0)!;
    
    expect(p.lng).toBeGreaterThan(32); 
  });

  it("İstanbul/İzmir dışındaki iller de gerçek ilçeye dağılır (Ankara Keçiören)", () => {
    const kecioren = placeListing("Ankara", "X Mah. Keçiören, Ankara", 0)!;
    const cankaya = placeListing("Ankara", "Y Mah. Çankaya, Ankara", 0)!;
   
    expect(kecioren.lat).not.toBeCloseTo(cankaya.lat, 2);
  });

  it("bilinmeyen şehir için null döner", () => {
    expect(placeListing("Foo Bar Şehri", "", 0)).toBeNull();
  });

  it("deterministiktir", () => {
    expect(placeListing("İstanbul", "Kadıköy", 7)).toEqual(
      placeListing("İstanbul", "Kadıköy", 7)
    );
  });

  it("il MERKEZ ilçesini de tanır (İzmit) — eski veri setinde yoktu", () => {
    const izmit = resolvePlacement("Kocaeli", "Yenişehir Mh. İzmit, Kocaeli", 0)!;
    const gebze = resolvePlacement("Kocaeli", "Sultan Orhan Mh. Gebze, Kocaeli", 0)!;
    expect(izmit.level).toBe("district");
    expect(izmit.district).toBe("izmit");
    expect(gebze.district).toBe("gebze");
    
    expect(gebze.lng).toBeLessThan(izmit.lng - 0.2);
  });

  it("kısa ilçe adları alt-dize olarak YANLIŞ eşleşmez (Of ≠ profesyonel)", () => {
    
    const p = resolvePlacement("Trabzon", "Profesyonel Oto Galeri, Trabzon", 0)!;
    expect(p.district).not.toBe("of");
  
    const q = resolvePlacement("Niğde", "Bornova Sokak No:5, Niğde", 0)!;
    expect(q.district).not.toBe("bor");
  });

  it("serbest metinde geçen İL ADI merkez ilçe sayılmaz (yankı koruması)", () => {
    
    const echo = resolvePlacement("Trabzon", "", 0, "Honda Civic 2016 Model Trabzon 183.000 km")!;
    expect(echo.level).toBe("province");
    
    const real = resolvePlacement("Trabzon", "", 0, "Aracımız Of ilçesindeki şubemizdedir")!;
    expect(real.level).toBe("district");
    expect(real.district).toBe("of");
  });

  it("adres varsa açıklamaya bakılmaz (şube adresi gerçek konumu ezmesin)", () => {
    const p = resolvePlacement(
      "İstanbul",
      "Caferağa Mh. Kadıköy, İstanbul",
      0,
      "Şubemiz Silivri'dedir, test için getirilebilir"
    )!;
    expect(p.district).toBe("kadikoy");
    expect(p.source).toBe("address");
  });

  it("şehir alanına ilçe adı yazılmışsa ilini bulur (Silivri → İstanbul)", () => {
    const p = resolvePlacement("Silivri", "", 0)!;
    expect(p.level).toBe("district");
    expect(p.district).toBe("silivri");
    expect(p.lng).toBeLessThan(28.5); 
  });
});
