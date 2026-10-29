/**
 * Doğrulanmış Araç Donanım Matrisi ve Kural Motoru
 *
 * Satıcıların ilan açıklamalarına hatalı/şablon donanım yazmasını önlemek için;
 * - Dönem/Yıl kısıtlamaları (Era feasibility rules)
 * - Segment/Kasa kısıtlamaları (Gatekeeper rules)
 * - Resmi Donanım Paketleri Broşür Kuralları (Volkswagen Trendline vs Highline, Egea Easy vs Lounge, Chery Luxury vs Excellence vb.)
 * - Bounded Negation Filtreleri ("...hariç", "...yok", "...bulunmamaktadır" - hasar kaydı ile karışmaz!)
 * - Fabrika standart baz donanım kuralları (Porsche Macan Turbo, Mercedes EQS, BMW M Sport vb.)
 * birlikte işletilir.
 */

import { matchTrimPackage } from "./trim-packages";

export interface EquipmentItem {
  id: string;
  name: string;
  present: boolean;
}

export interface EquipmentCategory {
  id: "safety" | "comfort" | "exterior" | "multimedia";
  title: string;
  items: EquipmentItem[];
}

export interface EvaluatedCarInfo {
  brand?: string;
  model?: string;
  title?: string;
  year?: number;
  vehicleClass?: string;
  description?: string;
  features?: {
    fuelType?: string;
    bodyType?: string;
    transmission?: string;
  };
}

/**
 * Dönem ve Segment Bariyerleri (Negatif Kurallar)
 * Bir aracın üretim yılı veya segmenti bu teknolojinin var olmasına imkan tanımıyorsa,
 * ilanın açıklamasında geçse dahi KESİNLİKLE "Yok (false)" olarak işaretlenir.
 */
function isFeatureFeasible(featureId: string, car: EvaluatedCarInfo): boolean {
  const year = car.year || 2020;
  const brand = (car.brand || "").toLowerCase();
  const model = (car.model || "").toLowerCase();
  const vClass = (car.vehicleClass || car.features?.bodyType || "").toLowerCase();
  const hay = `${brand} ${model} ${vClass}`;

  const isLuxuryBrand = /porsche|mercedes|bmw|audi|volvo|lexus|land rover|range rover|maserati|jaguar|tesla/i.test(brand);
  const isCommercialVan = /tourneo|connect|courier|doblo|fiorino|caddy|partner|berlingo|kangoo|transporter|vito|custom|ducato|boxer|jumper/i.test(hay);
  const isBudgetEconomy = /symbol|clio 2|clio 3|albea|palio|linea|sandero|logan|taliant|accent era|getz/i.test(hay);

  switch (featureId) {
    case "camera360":
      if (year < 2013) return false;
      if (isCommercialVan && year < 2024) return false;
      if (isBudgetEconomy) return false;
      if (year < 2018 && !isLuxuryBrand && !/tiggo|omoda/i.test(hay)) return false;
      return true;

    case "seatCooling":
      if (isCommercialVan || isBudgetEconomy) return false;
      if (!isLuxuryBrand && !/tiggo.*excellence|laurin|l&k|tucson|sportage prestige/i.test(hay) && year < 2022) return false;
      return true;

    case "carplayAndroidAuto":
      if (year < 2015) return false;
      return true;

    case "digitalCockpit":
      if (year < 2014) return false;
      if (isCommercialVan && year < 2022) return false;
      if (isBudgetEconomy && year < 2022) return false;
      if (year < 2017 && !isLuxuryBrand && !/passat|golf/i.test(hay)) return false;
      return true;

    case "laneAssist":
    case "blindSpot":
    case "emergencyBrake":
      if (year < 2012) return false;
      if (isCommercialVan && year < 2020) return false;
      if (isBudgetEconomy && year < 2021) return false;
      return true;

    case "adaptiveCruise":
      if (year < 2012) return false;
      if (isCommercialVan && year < 2021) return false;
      if (isBudgetEconomy && year < 2022) return false;
      if (year < 2017 && !isLuxuryBrand && !/tiggo|omoda/i.test(hay)) return false;
      return true;

    case "wirelessCharging":
      if (year < 2016) return false;
      return true;

    case "ledMatrixHeadlights":
      if (year < 2014) return false;
      if (isCommercialVan && year < 2023) return false;
      if (isBudgetEconomy && year < 2024) return false;
      return true;

    case "electricTailgate":
      if (year < 2010) return false;
      if (isCommercialVan) return false;
      if (isBudgetEconomy) return false;
      return true;

    case "heatedSteering":
      if (year < 2010) return false;
      if (isCommercialVan && year < 2023) return false;
      if (isBudgetEconomy) return false;
      return true;

    default:
      return true;
  }
}

export function normalizeEquipmentText(text: string): string {
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .toLowerCase();
}

/**
 * Açıklamadan özellik ararken KESİNLİKLE SINIRLI (bounded) olumsuzluk kontrolü
 * ÖNEMLİ: Hasar, tramer, boya, değişen ve kaza disclaimers'ları ("HASAR KAYDI : YOKTUR")
 * temizlenir, böylece donanım var/yok kontrolü ile hasar raporu ASLA birbirine karışmaz.
 */
function cleanDescriptionForEquipment(text: string): string {
  return normalizeEquipmentText(
    text
      .replace(
        /(?:hasar|tramer|boya|değişen|degisen|hata|kusur|kaza|lokal|şasi|podye|direk)(?:\s+(?:kaydı|kaydi|durumu|bilgisi))?\s*[:=-]?\s*(?:yoktur|yok|bulunmamaktadır|bulunmuyor|0\s*tl)/gi,
        " "
      )
      .replace(/hata\s*kusur(?:\s+\S+)?\s*(?:yoktur|yok)/gi, " ")
      .replace(/çizik(?:\s+dahi)?\s*(?:yoktur|yok)/gi, " ")
  );
}

function hasFeatureInText(text: string, positivePatterns: RegExp[], negativePatterns: RegExp[]): boolean {
  const cleaned = cleanDescriptionForEquipment(text);

  // Olumsuz bir ifade var mı? (Sadece kelimenin hemen yakınındaki olumsuzluk arar)
  for (const neg of negativePatterns) {
    if (neg.test(cleaned)) return false;
  }

  // Olumlu bir eşleşme var mı?
  for (const pos of positivePatterns) {
    if (pos.test(cleaned)) return true;
  }

  return false;
}

/**
 * Fabrika Çıkışı Standart Donanım Belirleme (Resmi Katalog Standartları)
 * Ultra lüks veya modern amiral gemisi araçlarda (Porsche Macan Turbo, Mercedes EQS, BMW M Sport vb.)
 * satıcı tek kelime açıklama yazmamış olsa dahi fabrikasyon standart gelen temel özellikleri doğrular.
 */
function isStandardFactoryEquipment(featureId: string, car: EvaluatedCarInfo): boolean {
  const brand = (car.brand || "").toLowerCase();
  const model = (car.model || "").toLowerCase();
  const title = (car.title || "").toLowerCase();
  const year = car.year || 2020;
  const hay = `${brand} ${model} ${title}`;

  const isCommercialVan =
    /tourneo|connect|courier|custom|transit|doblo|fiorino|caddy|transporter|crafter|boxer|ducato|combo|vivaro|partner|berlingo/i.test(hay);

  // 1. ABS & ESP: 2004 sonrası tüm binek araçlarda temel fren güvenliği standardı
  if (featureId === "absEsp") return year >= 2004;

  // 2. ISOFIX: 2012 sonrası tüm binek araçlarda çocuk koltuğu standardı
  if (featureId === "isofix") return year >= 2012;

  // 3. Lastik Basınç Uyarı Sistemi (TPMS): 2014 sonrası standart
  if (featureId === "tirePressure") return year >= 2014;

  // 4. Hava Yastığı (Airbag): 2010 sonrası bineklerde temel 6 hava yastığı
  if (featureId === "airbags") return !isCommercialVan && year >= 2010;

  // 5. Yokuş Kalkış Desteği: 2018 sonrası binek araçlarda
  if (featureId === "hillHolder") return !isCommercialVan && year >= 2018;

  // 6. TESLA & TOGG (Paket ayrımı olmayan, yekpare donanım ve sensör mimarisine sahip araçlar)
  if (/tesla|togg/i.test(hay)) {
    switch (featureId) {
      case "laneAssist":
      case "blindSpot":
      case "emergencyBrake":
      case "adaptiveCruise":
      case "seatHeating":
      case "electricSeats":
      case "electricTailgate":
      case "camera360":
      case "sunroof":
      case "wirelessCharging":
      case "navigation":
      case "touchScreen":
      case "keylessGo":
      case "digitalClimate":
      case "digitalCockpit":
      case "foldingMirrors":
      case "rainSensor":
      case "ledMatrixHeadlights":
      case "ambientLighting":
        return true;
      default:
        break;
    }
  }

  // 7. ULTRA LÜKS VE YÜKSEK PERFORMANS SERİLERİ (Mercedes-AMG 43/53/63, Porsche Turbo/GTS, BMW M/M-Performance, Audi S/RS, Maserati vb.)
  const isHighPerformanceOrUltraLuxury =
    /(?:amg\s*(?:43|53|63|65)|(?:43|53|63|65)\s*amg|glc.*(?:43|63)|gle.*(?:53|63)|c\s*63|e\s*63|s\s*63|s\s*class|s\s*serisi|s\s*350|s\s*400|s\s*500|eqs|eqe|maybach)/i.test(hay) ||
    /(?:porsche.*(?:turbo|gts|taycan|panamera)|macan.*turbo|cayenne.*(?:turbo|gts)|911)/i.test(hay) ||
    /(?:m135i|m235i|m340i|m440i|m550i|m850i|\bm[23458]\b|x[356]\s*m)/i.test(hay) ||
    /(?:audi.*(?:rs[3-7]|rs\s*q[38]|s[3-8]|e-tron\s*gt))/i.test(hay) ||
    /(?:maserati|bentley|ferrari|rolls\s*royce|aston\s*martin)/i.test(hay);

  if (isHighPerformanceOrUltraLuxury) {
    switch (featureId) {
      case "navigation":          // Fabrikasyon MBUX / PCM / BMW Pro / MMI Navigasyon
      case "premiumAudio":        // Burmester, BOSE, Harman Kardon, Bang & Olufsen
      case "camera360":           // 360 Çevre Görüş Kamerası
      case "digitalCockpit":      // Dijital Gösterge / Hayalet Ekran
      case "electricSeats":       // Hafızalı Elektrikli Koltuklar
      case "seatHeating":         // Ön Koltuk Isıtma
      case "electricTailgate":    // Elektrikli / Easy-Pack Bagaj
      case "ledMatrixHeadlights": // Matrix LED / Digital Light / PDLS+
      case "ambientLighting":     // İç Ambiyans Aydınlatma
      case "touchScreen":
      case "bluetooth":
      case "keylessGo":
      case "digitalClimate":
      case "foldingMirrors":
      case "rainSensor":
      case "blindSpot":
        return true;
      case "wirelessCharging":
        return year >= 2020;
      case "sunroof":
        // Üstü açılır roadster hariç fabrika standardı
        return !/cabrio|cabriolet|roadster|spider|spyder/i.test(hay);
      default:
        break;
    }
  }

  // 8. DAHİLİ NAVİGASYON: 2020+ modern dijital kokpit işletim sistemine sahip Alman Premium binek araçlar
  // (BMW Live Cockpit Plus/Pro, Mercedes MBUX, Audi MMI Navigation Plus, Volvo Google Built-in)
  if (featureId === "navigation") {
    if (year >= 2020 && /bmw/i.test(brand) && /(?:1\s*serisi|2\s*serisi|3\s*serisi|4\s*serisi|5\s*serisi|7\s*serisi|x[1-7]|i[3457x])/i.test(hay)) {
      return true;
    }
    if (year >= 2021 && /mercedes/i.test(brand) && /(?:c\s*serisi|c\s*\d|e\s*serisi|e\s*\d|s\s*serisi|s\s*\d|glc|gle|gls|cla|gla|glb|eq[a-z])/i.test(hay)) {
      return true;
    }
    if (year >= 2021 && /volvo/i.test(brand)) {
      return true;
    }
  }

  // 9. KABLOSUZ ŞARJ: 2022+ yeni nesil C/GLC Mercedes, 2022+ Audi Advanced/S line, 2021+ Volvo
  if (featureId === "wirelessCharging") {
    if (year >= 2022 && /mercedes/i.test(brand) && /(?:c\s*serisi|c\s*200|glc|e\s*serisi|eq[a-z])/i.test(hay)) {
      return true;
    }
    if (year >= 2022 && /audi/i.test(brand) && /(?:q3|a3|a4|a6)/i.test(hay)) {
      return true;
    }
  }

  // 10. EXECUTIVE & LUXURY SEGMENT BAZ FABRİKA STANDARDI (Segment E / F / Full-Size Luxury)
  // Mercedes E/S/CLS/GLE/GLS, BMW 5/6/7/8/X5/X6/X7, Audi A6/A7/A8/Q7/Q8, Porsche, Range Rover, Maserati
  const isExecutiveOrLuxurySegment =
    /(?:mercedes|benz)/i.test(brand) && /(?:e\s*serisi|e\s*\d|s\s*serisi|s\s*\d|cls|gle|gls|maybach|eqs|eqe)/i.test(hay) ||
    /bmw/i.test(brand) && /(?:5\s*serisi|5\s*\d|6\s*serisi|7\s*serisi|8\s*serisi|x[567]|i[57x])/i.test(hay) ||
    /audi/i.test(brand) && /(?:a[678]|q[78]|e-tron)/i.test(hay) ||
    /porsche|maserati|bentley|rolls\s*royce/i.test(brand) ||
    /(?:range\s*rover|land\s*rover)/i.test(brand) && /(?:vogue|autobiography|sport|velar|defender)/i.test(hay) ||
    /volvo/i.test(brand) && /(?:s90|xc90)/i.test(hay);

  if (isExecutiveOrLuxurySegment) {
    switch (featureId) {
      case "digitalClimate":   // Çift / Üç bölgeli otomatik iklimlendirme
      case "rainSensor":       // Otomatik yağmur ve far sensörü
      case "parkingSensors":   // Ön ve arka park sensörleri
      case "foldingMirrors":   // Elektrikli ısıtmalı katlanır yan aynalar
      case "leatherSeats":     // Deri koltuk döşemesi
      case "electricSeats":    // Elektrikli hafızalı koltuklar
      case "touchScreen":
      case "bluetooth":
        return true;
      case "sunroof":
        // Üstü açılır roadster/cabrio değilse cam tavan / sunroof standart
        return !/cabrio|cabriolet|roadster|spider|spyder/i.test(hay);
      case "navigation":
        return year >= 2012;
      case "rearCamera":
        return year >= 2016;
      case "digitalCockpit":
      case "carplayAndroidAuto":
      case "ledMatrixHeadlights":
        return year >= 2018;
      default:
        break;
    }
  }

  // 11. DOĞRULANMIŞ AKTİF SÜRÜŞ GÜVENLİĞİ (2024+ Yeni Nesil Lüks Binek Serileri)
  // 2024+ Audi (Audi pre sense front & active lane assist), 2023+ Mercedes (Active Brake & Lane Keeping)
  if (featureId === "emergencyBrake" || featureId === "laneAssist") {
    if (year >= 2024 && /audi/i.test(brand) && /(?:q[2-8]|a[3-8]|e-tron)/i.test(hay)) {
      return true;
    }
    if (year >= 2023 && /mercedes/i.test(brand) && /(?:c\s*serisi|c\s*\d|e\s*serisi|e\s*\d|s\s*serisi|s\s*\d|glc|gle|eq[a-z])/i.test(hay)) {
      return true;
    }
    if (year >= 2023 && /bmw/i.test(brand) && /(?:3\s*serisi|5\s*serisi|7\s*serisi|x[3-7]|i[457x])/i.test(hay)) {
      return true;
    }
  }

  return false;
}

/**
 * Donanım Özellikleri Sözlüğü ve Doğrulama Kuralları
 * (Negatif kurallarda kesinlikle açgözlü .* yoktur; 1-3 kelimelik lokal olumsuzluk arar!)
 */
interface FeatureDefinition {
  id: string;
  name: string;
  positive: RegExp[];
  negative: RegExp[];
}

const SAFETY_FEATURES: FeatureDefinition[] = [
  {
    id: "absEsp",
    name: "ABS & ESP (Elektronik Denge)",
    positive: [/\b(abs|esp|asr|edl|ebd|stabilite)\b/i, /denge kontrol/i],
    negative: [/\b(?:abs|esp)\s*(?:yok|hariç|bulunm)/i],
  },
  {
    id: "hillHolder",
    name: "Yokuş Kalkış Desteği",
    positive: [/yokuş kalkış/i, /hill holder/i, /hill assist/i, /auto hold/i],
    negative: [/yokuş kalkış(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "laneAssist",
    name: "Şerit Takip Sistemi",
    positive: [
      /şerit\s*(?:takip|koruma|asistan|ihlal|uyarı|destek|ortala)/i,
      /lane\s*(?:assist|keeping|departure|centering)/i,
      /şeritte\s*kalma/i,
    ],
    negative: [/şerit takip(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "blindSpot",
    name: "Kör Nokta Uyarı Sistemi",
    positive: [
      /kör\s*nokta/i,
      /blind\s*spot/i,
      /side\s*assist/i,
      /lane\s*change\s*assist/i,
      /\bblis\b/i,
    ],
    negative: [/kör nokta(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "emergencyBrake",
    name: "Çarpışma Önleme & Acil Fren",
    positive: [
      /çarpışma\s*(?:önle|uyarı|ikaz|asistan)/i,
      /front\s*assist/i,
      /acil\s*fren/i,
      /pre-safe/i,
      /acil\s*durum.*asistanı/i,
      /yaya\s*koruma/i,
      /active\s*brake\s*assist/i,
      /warn\s*and\s*brake/i,
      /\bcity\s*safety\b/i,
      /pre-collision/i,
    ],
    negative: [/çarpışma(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "adaptiveCruise",
    name: "Adaptif Hız Sabitleyici (ACC)",
    positive: [
      /adaptif\s*(?:hız|cruise)/i,
      /\bacc\b/i,
      /\bdistronic(?:plus)?\b/i,
      /otonom\s*sürüş/i,
      /mesafe\s*takip/i,
      /\binnodrive\b/i,
      /\btravel\s*assist\b/i,
      /\bpilot\s*assist\b/i,
      /\bautopilot\b/i,
    ],
    negative: [/\b(?:acc|distronic|adaptif)\s*(?:yok|hariç)/i],
  },
  {
    id: "airbags",
    name: "Hava Yastığı (En Az 6 Airbag)",
    positive: [/\b(6|8|10|12)\s*(hava yastığı|airbag)/i, /perde hava yastık/i, /yan hava yastık/i, /çoklu airbag/i],
    negative: [/airbag(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "isofix",
    name: "ISOFIX Çocuk Koltuğu",
    positive: [/isofix/i, /çocuk koltuğu sabitleme/i],
    negative: [/isofix(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "tirePressure",
    name: "Lastik Basınç Uyarı Sistemi",
    positive: [/lastik basınç/i, /tpms/i, /tire pressure/i, /lastik arıza/i],
    negative: [/lastik basınç(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
];

const COMFORT_FEATURES: FeatureDefinition[] = [
  {
    id: "seatHeating",
    name: "Koltuk Isıtma (Ön/Arka)",
    positive: [
      /koltuk.*[iı]s[iı]tma/i,
      /[iı]s[iı]tmal[iı].*koltuk/i,
      /seat\s*heating/i,
      /[iı]s[iı]tmal[iı]\s*ön\s*koltuk/i,
      /ön\s*koltuk\s*[iı]s[iı]tma/i,
      /(?:ön|arka|4|dört)\s*koltuk(?:lar)?(?:da)?\s*[iı]s[iı]tma/i,
      /\bkoltuk\s*[iı]s[iı]t/i,
      /\b[iı]s[iı]tmal[iı]\b/i,
    ],
    negative: [/(?:koltuk\s*[iı]s[iı]tma|[iı]s[iı]tmal[iı]\s*koltuk)(?:\s+\S+){0,3}\s+(?:yok|hariç|bulunm)/i],
  },
  {
    id: "seatCooling",
    name: "Koltuk Soğutma / Havalandırma",
    positive: [
      /koltuk.*soğutma/i,
      /soğutmal[iı].*koltuk/i,
      /koltuk.*havaland[iı]rma/i,
      /havaland[iı]rmal[iı].*koltuk/i,
      /seat\s*ventilation/i,
      /\bkoltuk\s*soğut/i,
    ],
    negative: [/(?:koltuk\s*soğutma|soğutmal[iı]\s*koltuk)(?:\s+\S+){0,3}\s+(?:yok|hariç|bulunm)/i],
  },
  {
    id: "electricSeats",
    name: "Elektrikli & Hafızalı Koltuklar",
    positive: [/haf[iı]zal[iı]\s*koltuk/i, /elektrikli koltuk/i, /memory seat/i, /elektrikli.*haf[iı]zal[iı]/i, /spor koltuk/i],
    negative: [/(?:elektrikli|haf[iı]zal[iı])\s*koltuk(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "leatherSeats",
    name: "Deri Koltuk Döşeme",
    positive: [/deri koltuk/i, /deri döşeme/i, /leather/i, /alcantara/i, /nappa/i, /artico/i],
    negative: [/deri koltuk(?:\s+\S+){0,3}\s+(?:yok|hariç)/i, /kumaş döşeme/i],
  },
  {
    id: "digitalClimate",
    name: "Çok Bölgeli Dijital Klima",
    positive: [/dijital klima/i, /çift bölge/i, /dört bölge/i, /climatronic/i, /thermotronic/i, /otomatik klima/i],
    negative: [/dijital klima(?:\s+\S+){0,3}\s+(?:yok|hariç)/i, /manuel klima/i],
  },
  {
    id: "keylessGo",
    name: "Anahtarsız Giriş & Çalıştırma",
    positive: [
      /anahtars[iı]z/i,
      /keyless/i,
      /start.*stop tuş/i,
      /start-stop düğme/i,
      /eller serbest giriş/i,
      /comfort access/i,
      /\bkessy\b/i,
    ],
    negative: [/anahtars[iı]z(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "digitalCockpit",
    name: "Hayalet Gösterge (Dijital Kokpit)",
    positive: [
      /hayalet\s*(?:ekran|gösterge|kadran|panel)/i,
      /\bhayalet\b/i,
      /dijital\s*(?:gösterge|kokpit|kadran|panel)/i,
      /virtual\s*cockpit/i,
      /hyperscreen/i,
      /live\s*cockpit/i,
      /kavisli\s*ekran/i,
      /\bopenr\b/i,
      /i-cockpit/i,
    ],
    negative: [/(?:hayalet|dijital\s*gösterge)(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "heatedSteering",
    name: "Isıtmalı Direksiyon",
    positive: [/[iı]s[iı]tmal[iı]\s*direksiyon/i, /direksiyon\s*[iı]s[iı]tma/i, /heated steering/i],
    negative: [/direksiyon\s*[iı]s[iı]tma(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "ambientLighting",
    name: "İç Ambiyans Aydınlatma",
    positive: [
      /ambiyans|ambiance/i,
      /ortam\s*ayd[iı]nlatma/i,
      /ambient lighting/i,
      /\b(?:10|30|64)\s*renk\b/i,
      /iç\s*[iı]ş[iı]k\s*paketi|[iı]ş[iı]k\s*paketi?/i,
    ],
    negative: [/ambiyans(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
];

const EXTERIOR_FEATURES: FeatureDefinition[] = [
  {
    id: "camera360",
    name: "360° Çevre Görüş Kamerası",
    positive: [
      /(?:360|360°|360')\s*(?:derece)?\s*(?:kamera|görüş|view)/i,
      /çevre\s*(?:görüş|kamera)/i,
      /surround\s*view/i,
      /kuş\s*bak[iı]ş[iı]\s*kamera/i,
      /area\s*view/i,
      /aktif\s*park.*çevre\s*görüş/i,
      /\b(?:4|dört)\s*kamera\b/i,
      /around\s*view/i,
    ],
    negative: [/(?:360|çevre\s*görüş)(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "rearCamera",
    name: "Geri Görüş Kamerası",
    positive: [/geri görüş/i, /rear camera/i, /park\s*kameras[iı]/i, /arka kamera/i],
    negative: [/geri görüş(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "parkingSensors",
    name: "Ön & Arka Park Sensörü",
    positive: [/park sensör/i, /ön.*arka park/i, /parktronik/i, /parktronic/i, /park pilot/i, /aktif park/i],
    negative: [/park sensör(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "sunroof",
    name: "Panoramik Cam Tavan / Sunroof",
    positive: [
      /pan[ao]r[ao]m[ia]k(?:\s+\S+){0,3}\s*tavan/i,
      /pan[ao]r[ao]m[ia]k(?:\s+cam|\s+a[çc][iı]l[iı]r|\s+sunroof)?/i,
      /cam\s*tavan|camtavan/i,
      /sunroof/i,
      /panoroma/i,
      /a[çc][iı]l[iı]r\s*tavan/i,
    ],
    negative: [
      /(?:cam\s*tavan|sunroof|pan[ao]r[ao]m[ia]k)(?:\s+\S+){0,3}\s+(?:yok|hariç|bulunm)/i,
      /(?:hariç|olmayan)\s*:\s*(?:cam\s*tavan|sunroof)/i,
    ],
  },
  {
    id: "ledMatrixHeadlights",
    name: "LED / Matrix LED Farlar",
    positive: [
      /matrix\s*led|led\s*matrix/i,
      /digital\s*light/i,
      /multibeam/i,
      /laser\s*light/i,
      /iq\.?\s*light/i,
      /led\s*far/i,
      /bi-xenon/i,
      /dynamic\s*far/i,
      /\bpdls\+?\b/i,
      /\bintellilux\b/i,
      /\bpure\s*vision\b/i,
    ],
    negative: [/(?:matrix|led\s*far)(?:\s+\S+){0,3}\s+(?:yok|hariç)/i, /halojen far/i],
  },
  {
    id: "electricTailgate",
    name: "Elektrikli / Eller Serbest Bagaj",
    positive: [
      /elektrikli\s*bagaj/i,
      /otomatik\s*bagaj/i,
      /eller\s*serbest\s*bagaj/i,
      /ayak(?:la|\s+ile)\s*(?:a[çc][iı]lan|açma)/i,
      /power\s*tailgate/i,
      /easy\s*open/i,
      /vakumlu\s*bagaj/i,
      /smart\s*tailgate/i,
    ],
    negative: [/elektrikli bagaj(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "foldingMirrors",
    name: "Elektrikli Katlanır Yan Aynalar",
    positive: [/katlanır ayna/i, /otomatik katlanan ayna/i, /elektrikli katlanır/i],
    negative: [/katlanır ayna(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "rainSensor",
    name: "Yağmur & Far Sensörü",
    positive: [/yağmur sensör/i, /far sensör/i, /otomatik yanan far/i, /[iı]ş[iı]k sensör/i],
    negative: [/yağmur sensör(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
];

const MULTIMEDIA_FEATURES: FeatureDefinition[] = [
  {
    id: "carplayAndroidAuto",
    name: "Apple CarPlay & Android Auto",
    positive: [
      /carplay/i,
      /android\s*auto/i,
      /akıllı\s*telefon\s*entegrasyon/i,
      /mirrorlink/i,
      /smartlink/i,
      /app-?connect/i,
      /full\s*-?\s*link/i,
    ],
    negative: [/(?:carplay|android\s*auto)(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "wirelessCharging",
    name: "Kablosuz Şarj (Wireless Charge)",
    positive: [/kablosuz\s*şarj/i, /wireless\s*charg/i, /kablosuz\s*telefon\s*şarj/i, /indüksiyon\s*şarj/i],
    negative: [/kablosuz şarj(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "touchScreen",
    name: "Dokunmatik Multimedya Ekranı",
    positive: [
      /dokunmatik ekran/i,
      /multimedya ekran/i,
      /touchscreen/i,
      /büyük ekran/i,
      /merkezi ekran/i,
      /hyperscreen/i,
      /tablet ekran/i,
      /yolcu ekranı/i,
    ],
    negative: [/dokunmatik\s*ekran(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "navigation",
    name: "Dahili Navigasyon Sistemi",
    positive: [/navigasyon/i, /harita sistemi/i, /gps/i, /mbux navigasyon/i, /pcm/i],
    negative: [/navigasyon(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "bluetooth",
    name: "Bluetooth & Eller Serbest",
    positive: [/bluetooth/i, /eller serbest konuşma/i, /handsfree/i, /telefon bağlantı/i],
    negative: [/bluetooth(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "premiumAudio",
    name: "Premium Ses Sistemi",
    positive: [
      /burmester/i,
      /harman\s*\/?\s*kardon/i,
      /\bbose\b/i,
      /bang\s*&\s*olufsen/i,
      /\bb&o\b/i,
      /meridian/i,
      /focal/i,
      /\bjbl\b/i,
      /dynaudio/i,
      /\bcanton\b/i,
      /bowers\s*(?:&|ve)?\s*wilkins/i,
      /\bb&w\b/i,
      /ses sistemi/i,
      /elektronik spor ses/i,
    ],
    negative: [/ses sistemi(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
];

/**
 * Belirli bir araç için 4 ana kategoride donanım matrisini doğrular ve üretir.
 */
export function evaluateCarEquipment(car: EvaluatedCarInfo): EquipmentCategory[] {
  const text = `${car.title || ""} ${car.description || ""}`.trim();
  const trimRules = matchTrimPackage({
    brand: car.brand,
    model: car.model,
    title: car.title,
    description: car.description,
    year: car.year,
  });

  function evaluateList(definitions: FeatureDefinition[]): EquipmentItem[] {
    return definitions.map((def) => {
      // 1. Dönem ve segment filtresi — fiziksel/tarihsel olarak imkansızsa KESİNLİKLE FALSE
      if (!isFeatureFeasible(def.id, car)) {
        return { id: def.id, name: def.name, present: false };
      }

      // 2. Resmi broşür paket kuralında bu donanım KESİNLİKLE YOKSA (örn: Egea Easy'de dokunmatik ekran, CarPlay veya sunroof olamaz)
      if (trimRules?.excludedFeatures?.includes(def.id)) {
        return { id: def.id, name: def.name, present: false };
      }

      // 3. Resmi broşür paket kuralında bu donanım STANDART İSE (örn: Corolla Passion'da sunroof & koltuk ısıtma; Chery Excellence'da koltuk soğutma & 360 kamera)
      if (trimRules?.standardFeatures?.includes(def.id)) {
        const isExplicitlyNegated = def.negative.some((neg) => neg.test(text.toLocaleLowerCase("tr-TR")));
        if (!isExplicitlyNegated) {
          return { id: def.id, name: def.name, present: true };
        }
      }

      // 4. Fabrika çıkışı standart donanım teyidi (Porsche Macan Turbo, Mercedes EQS vb.)
      if (isStandardFactoryEquipment(def.id, car)) {
        return { id: def.id, name: def.name, present: true };
      }

      // 5. İlan metni ve açıklamada pozitif arama (olumsuzluk filtreleriyle teyitli)
      const foundInText = hasFeatureInText(text, def.positive, def.negative);
      return {
        id: def.id,
        name: def.name,
        present: foundInText,
      };
    });
  }

  return [
    {
      id: "safety",
      title: "Güvenlik & Sürüş Destek",
      items: evaluateList(SAFETY_FEATURES),
    },
    {
      id: "comfort",
      title: "İç Mekan & Konfor",
      items: evaluateList(COMFORT_FEATURES),
    },
    {
      id: "exterior",
      title: "Dış Donanım & Görüş",
      items: evaluateList(EXTERIOR_FEATURES),
    },
    {
      id: "multimedia",
      title: "Multimedya & Teknoloji",
      items: evaluateList(MULTIMEDIA_FEATURES),
    },
  ];
}
