import { PENDING_FEATURE_LABEL } from "@/lib/scraper/feature-merge";
import { engineFromText } from "@/lib/fuel-cost";

/**
 * İlan kalitesi (ekranda bu adla görünür), kodda "bilgi tamlığı": ilanın 0–100 arası ne kadar eksiksiz bilgi verdiği.
 * Aracın durumunu, fiyatın doğruluğunu ya da satıcının güvenilirliğini ölçmez; yalnızca ilanın kendi alanlarına bakar.
 *
 * Ölçütler (toplam 100):
 * - Fotoğraf (25): en az 10 fotoğraf tam puan; az fotoğraf kademeli düşer.
 * - Açıklama (30): uzunluk (12) ve altı bilgi konusu (her biri 3): bakım, parça ve boya, donanım, kullanım geçmişi,
 *   belge ve muayene, lastik-fren. Konular Türkçe kök eşleşmesiyle bulunur ("bakım", "bakımı", "bakımları" hepsi eşleşir).
 * - Hasar / boya bilgisi (15): boya-değişen metni, parça listesi ya da hasar kaydı bilgisi.
 * - Temel özellikler (30): yakıt, vites, kasa tipi, renk ve motor hacmi (her biri 6).
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

/** Açıklamada aranan bilgi konuları. Kökler Türkçe çekim eklerini kapsar; bu yüzden sona sınır (\b) konmadı. */
export const DESCRIPTION_TOPICS: ReadonlyArray<{ key: string; label: string; pattern: RegExp }> = [
  { key: "bakim", label: "bakım", pattern: /bakım|bakim|servis|periyodik|yağ değişim|yag degisim|fatura/ },
  { key: "parca", label: "parça/boya", pattern: /boya|değişen|degisen|değişim|degisim|lokal|orijinal|orjinal|tramer|hasar/ },
  { key: "donanim", label: "donanım", pattern: /donanım|donanim|paket|deri|navigasyon|sunroof|tavan|kamera|sensör|sensor|ısıtma|isitma|hafıza|hafiza|bluetooth|xenon|cruise|koltuk/ },
  { key: "kullanim", label: "kullanım", pattern: /tek sahip|ilk sahip|tek el|ilk el|garaj|kapalı otopark|kapali otopark|sigara|kazasız|kazasiz|kaza yok/ },
  { key: "belge", label: "belge/muayene", pattern: /muayene|ruhsat|noter|belge|ekspertiz|kayıt|kayit/ },
  { key: "lastik", label: "lastik/fren", pattern: /lastik|fren|balata|akü|aku|triger|kayış|kayis|amortis|süspansiyon|suspansiyon/ },
];

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
  /** İlan başlığı: motor hacmi yapısal alanda yoksa başlıktan okunur ("Renault Clio 1.0 TCE" → 1.0). */
  title?: string | null;
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
    engineSize?: number | null;
  } | null;
}

export function listingCompleteness(input: ListingCompletenessInput): ListingCompleteness {
  const photos = input.images?.length ?? 0;
  const photoPoints = photos >= 10 ? 25 : photos >= 6 ? 17 : photos >= 3 ? 9 : photos >= 1 ? 3 : 0;

  const description = (input.description ?? "").trim();
  const length = description.length;
  const lengthPoints = length >= 300 ? 12 : length >= 150 ? 7 : length >= 40 ? 3 : length >= 1 ? 1 : 0;
  const folded = description.toLocaleLowerCase("tr-TR");
  const topics = DESCRIPTION_TOPICS.filter((topic) => topic.pattern.test(folded));
  const topicPoints = topics.length * 3;
  const missingTopics = DESCRIPTION_TOPICS.filter((topic) => !topics.includes(topic)).map((topic) => topic.label);

  // Hasar/boya bilgisi: boya-değişen metni, parça listesi ya da açık hasar kaydı. "Belirtilmemiş" bilgi değildir.
  const damageKnown = isKnownValue(input.paintChange) || (input.damageParts?.length ?? 0) > 0 || input.damageFlag === true;

  const f = input.features ?? {};
  // Motor hacmi: yapısal alan ya da başlık metni (fiyat skalasının okuduğu ile aynı kaynak).
  const engineKnown = (f.engineSize ?? 0) > 0 || engineFromText(input.title) !== null;
  const featureList = [
    { label: "Yakıt", known: isKnownValue(f.fuelType) },
    { label: "Vites", known: isKnownValue(f.transmission) },
    { label: "Kasa tipi", known: isKnownValue(f.bodyType) },
    { label: "Renk", known: isKnownValue(f.color) },
    { label: "Motor hacmi", known: engineKnown },
  ];
  const featureEarned = featureList.reduce((sum, item) => sum + (item.known ? 6 : 0), 0);
  const featureMissing = featureList.filter((item) => !item.known).map((item) => item.label);

  const items: ListingCompletenessItem[] = [
    { key: "fotograf", label: "Fotoğraf", earned: photoPoints, max: 25, note: `${photos} fotoğraf${photos < 10 ? ` · ${10 - photos} daha ekle` : ""}` },
    {
      key: "aciklama",
      label: "Açıklama",
      earned: lengthPoints + topicPoints,
      max: 30,
      note: missingTopics.length > 0 ? `${length} karakter · Eksik: ${missingTopics.join(", ")}` : `${length} karakter`,
    },
    {
      key: "hasar",
      label: "Hasar / boya bilgisi",
      earned: damageKnown ? 15 : 0,
      max: 15,
      note: damageKnown ? "Bilgi verilmiş" : "Bilgi verilmemiş",
    },
    {
      key: "ozellikler",
      label: "Temel özellikler",
      earned: featureEarned,
      max: 30,
      note: featureMissing.length > 0 ? `Eksik: ${featureMissing.join(", ")}` : "Yakıt, vites, kasa tipi, renk ve motor hacmi belli",
    },
  ];

  return { score: items.reduce((sum, item) => sum + item.earned, 0), items };
}
