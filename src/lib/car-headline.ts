/**
 * Bazı kaynaklar modeli büyük harfle yazıyor ("SPORTAGE", "CADDY", "GOLF"): tamamen büyük kelimeler düzeltilir.
 * Kısa kodlar olduğu gibi kalır: 3 harfliler (GLC, TSI, AMG), I ile biten motor kodları (TDCI, TFSI, VVTI),
 * sesli harfsiz kısaltmalar ve rakamlı ifadeler (X5, 1.6).
 */
export function tidyCaps(text: string): string {
  return text.replace(/(?<![A-Za-zÇĞİÖŞÜçğıöşü0-9])[A-ZÇĞİÖŞÜ]{4,}(?![A-Za-zÇĞİÖŞÜçğıöşü0-9])/g, (word) => {
    if (word.length === 4 && (!/[AEIOUÖÜİ]/.test(word) || /[Iİ]$/.test(word))) return word;
    // Model adları çoğunlukla yabancı: I da İ de "i" olur ("COMBI" → "Combi", Türkçe kuralla "Combı" olurdu).
    return word.charAt(0) + word.slice(1).replace(/[Iİ]/g, "i").toLowerCase();
  });
}

/**
 * Kartların başlığı: "Opel Insignia 1.6 CDTI". Satıcının ilan başlığı ("2016 OPEL İNSİGNİA 123.000 KM'DE...")
 * ikinci satırda kalır. Marka/model yoksa (eski kayıt) ilan başlığı kullanılır.
 */
export function carHeadline(car: { title: string; brand?: string; model?: string }): string {
  const brand = car.brand?.trim();
  const model = car.model?.trim();
  if (!brand || !model) return car.title;
  const name = model.toLocaleLowerCase("tr").startsWith(brand.toLocaleLowerCase("tr")) ? model : `${brand} ${model}`;
  return tidyCaps(name);
}
