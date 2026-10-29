/**
 * İNTERNETTEN DOĞRULANMIŞ FABRİKA TEKNİK VERİSİ (marka resmi Türkiye sitesi)
 *
 * `scripts/official-specs.ts` bu markaların resmi TR sitelerindeki teknik özellik sayfalarını okuyup
 * `official-specs-data.ts` dosyasına yazar (bkz. `scripts/model-catalog.ts` ile aynı desen: üretilen statik
 * veri dosyası, veritabanı koleksiyonu değil — `resolveTechnicalSpecs` senkron çalışır).
 *
 * Eşleştirme: marka + model ailesi (kelime sınırlı) + beygir gücü BİREBİR + yakıt sınıfı. Motor hacmi
 * eşleştirmede KULLANILMAZ: ilan verisinde yanlış girilmiş olabiliyor (ör. 1.6 Multijet, DB'de 1.2 yazıyor).
 * Yıl eşleştirmede kullanılmaz: kaynak sayfalar güncel model yılını gösterir, eski ilanlarda aynı beygir
 * değeri farklı nesilden gelebilir ama bu nadir ve beygir eşleşmesi zaten güçlü bir filtre.
 */

export interface OfficialSpecEntry {
  /** Marka adı (DB'deki `brand` ile büyük/küçük harf duyarsız karşılaştırılır). */
  brand: string;
  /** Model ailesi; DB'deki `model`/`title` metninde kelime sınırlı arama yapılır (ör. "Clio" → /\bclio\b/i). */
  modelFamily: string;
  /** Kaynağın bildirdiği beygir gücü (PS/HP); DB'deki `features.horsepower` ile birebir eşleşmeli. */
  horsepower: number;
  /** "dizel" | "elektrik" kesin eşleşir; "diger" (benzin/hibrit/LPG) birbiriyle eşleşir (satıcılar hafif hibriti çoğu zaman "Benzin" yazar). */
  fuelClass: "dizel" | "elektrik" | "diger";
  /** Kaynak sayfadaki motor açıklaması (debug/izlenebilirlik için, ekranda gösterilmez). */
  engineLabel: string;
  acceleration?: number;
  topSpeed?: number;
  torque?: number;
  trunkCapacity?: number;
  fuelTank?: string;
  curbWeight?: number;
  sourceUrl: string;
  fetchedAt: string;
}

/** Yakıt metnini kaba sınıfa indirger. DB'nin "Hibrit"/"LPG & Benzin" değerleri de "diger"e düşer. */
export function fuelClassOf(raw: string | undefined): "dizel" | "elektrik" | "diger" {
  const t = (raw || "").toLowerCase();
  if (/dizel|diesel|\btdi\b/.test(t)) return "dizel";
  if (/elektrik|electric/.test(t)) return "elektrik";
  return "diger";
}

/**
 * Bir ilan için resmi kaynaktan doğrulanmış veri arar. Beygir gücü yoksa ya da hiçbir giriş eşleşmezse
 * `undefined` döner (tahmin üretmez).
 */
export function findOfficialSpec(
  entries: readonly OfficialSpecEntry[],
  car: { brand?: string; model?: string; title?: string; horsepower?: number; fuelType?: string }
): OfficialSpecEntry | undefined {
  const hp = car.horsepower;
  const brand = (car.brand || "").trim().toLowerCase();
  if (!hp || !brand) return undefined;
  const text = `${car.model || ""} ${car.title || ""}`.toLowerCase();
  const fuelClass = fuelClassOf(car.fuelType);
  return entries.find((e) => {
    if (e.brand.toLowerCase() !== brand) return false;
    if (e.horsepower !== hp) return false;
    if (e.fuelClass !== fuelClass) return false;
    return new RegExp(`\\b${e.modelFamily.toLowerCase()}\\b`, "i").test(text);
  });
}
