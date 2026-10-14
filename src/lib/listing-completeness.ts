import { PENDING_FEATURE_LABEL } from "@/lib/scraper/feature-merge";

/**
 * İlan kalitesi (ekranda bu adla görünür), kodda "bilgi tamlığı": ilanın 0–100 arası ne kadar eksiksiz bilgi verdiği.
 * Aracın durumunu, fiyatın doğruluğunu ya da satıcının güvenilirliğini ölçmez; yalnızca ilanın kendi alanlarına bakar:
 * fotoğraf sayısı, açıklama uzunluğu, hasar/boya bilgisi ve temel özellikler.
 * Kaynak kontrol sıklığı (tazelik) bilerek dahil değil: bekçi döngüsüne bağlı, ilanın kendisini değil taramamızı ölçer.
 * Ayrıntılar gizlilik politikasında (#ilan-kalitesi). scraper/listing-quality.ts ayrı bir modül: galeri şartını uygular.
 */

/** Bilinmediğini söyleyen değerler (kaynak bilgi vermediğinde ya da veri henüz doğrulanmadığında yazılır). */
const UNKNOWN = new Set(["", "Bilinmiyor", "Belirtilmemiş", "Bilgi yok", PENDING_FEATURE_LABEL]);

export function isKnownValue(value: string | null | undefined): boolean {
  return !UNKNOWN.has((value ?? "").trim());
}

/**
 * Puanın gösterilmediği kaynaklar. Otomerkezi'nin detay verisi eksik çekiliyor: örnek bir ilan kaynakta 404 veriyor ama
 * veritabanında hâlâ yayında, galeri ve hasar bilgisi çoğunlukla yok. Bu koşulda adil bir puan verilemez; düzelince açılır.
 */
export const QUALITY_HIDDEN_SOURCES: ReadonlySet<string> = new Set(["otomerkezi"]);

/** Puan yalnızca yayındaki ve güvenilir biçimde çekilen kaynakların ilanında gösterilir. */
export function showsListingQuality(listing: { status?: string | null; sourceSite?: string | null }): boolean {
  return listing.status === "active" && !QUALITY_HIDDEN_SOURCES.has(listing.sourceSite ?? "");
}

export interface ListingCompletenessItem {
  key: "fotograf" | "aciklama" | "hasar" | "ozellikler";
  label: string;
  earned: number;
  max: number;
  note: string;
}

export interface ListingCompleteness {
  score: number;
  items: ListingCompletenessItem[];
}

export interface ListingCompletenessInput {
  images?: readonly unknown[] | null;
  description?: string | null;
  paintChange?: string | null;
  damageParts?: readonly unknown[] | null;
  damageFlag?: boolean | null;
  features?: {
    fuelType?: string | null;
    transmission?: string | null;
    bodyType?: string | null;
    color?: string | null;
  } | null;
}

export function listingCompleteness(input: ListingCompletenessInput): ListingCompleteness {
  const photos = input.images?.length ?? 0;
  const photoPoints = photos >= 8 ? 35 : photos >= 4 ? 20 : photos >= 1 ? 10 : 0;

  const length = (input.description ?? "").trim().length;
  const descriptionPoints = length >= 200 ? 15 : length >= 80 ? 10 : length >= 1 ? 3 : 0;

  // Hasar/boya bilgisi: boya-değişen metni, parça listesi ya da açık hasar kaydı. "Belirtilmemiş" bilgi değildir.
  const damageKnown = isKnownValue(input.paintChange) || (input.damageParts?.length ?? 0) > 0 || input.damageFlag === true;

  const f = input.features ?? {};
  const featureList = [
    { label: "Yakıt", value: f.fuelType, max: 7 },
    { label: "Vites", value: f.transmission, max: 6 },
    { label: "Kasa tipi", value: f.bodyType, max: 6 },
    { label: "Renk", value: f.color, max: 6 },
  ];
  const featureEarned = featureList.reduce((sum, item) => sum + (isKnownValue(item.value) ? item.max : 0), 0);
  const featureMissing = featureList.filter((item) => !isKnownValue(item.value)).map((item) => item.label);

  const items: ListingCompletenessItem[] = [
    { key: "fotograf", label: "Fotoğraf", earned: photoPoints, max: 35, note: `${photos} fotoğraf` },
    { key: "aciklama", label: "Açıklama", earned: descriptionPoints, max: 15, note: `${length} karakter` },
    {
      key: "hasar",
      label: "Hasar / boya bilgisi",
      earned: damageKnown ? 25 : 0,
      max: 25,
      note: damageKnown ? "Bilgi verilmiş" : "Bilgi verilmemiş",
    },
    {
      key: "ozellikler",
      label: "Temel özellikler",
      earned: featureEarned,
      max: 25,
      note: featureMissing.length > 0 ? `Eksik: ${featureMissing.join(", ")}` : "Yakıt, vites, kasa tipi ve renk belli",
    },
  ];

  return { score: items.reduce((sum, item) => sum + item.earned, 0), items };
}
