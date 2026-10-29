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

/**
 * Açıklamadan özellik ararken KESİNLİKLE SINIRLI (bounded) olumsuzluk kontrolü
 * ÖNEMLİ: Hasar, tramer, boya, değişen ve kaza disclaimers'ları ("HASAR KAYDI : YOKTUR")
 * temizlenir, böylece donanım var/yok kontrolü ile hasar raporu ASLA birbirine karışmaz.
 */
function cleanDescriptionForEquipment(text: string): string {
  return text
    .replace(
      /(?:hasar|tramer|boya|değişen|degisen|hata|kusur|kaza|lokal|şasi|podye|direk)(?:\s+(?:kaydı|kaydi|durumu|bilgisi))?\s*[:=-]?\s*(?:yoktur|yok|bulunmamaktadır|bulunmuyor|0\s*tl)/gi,
      " "
    )
    .replace(/hata\s*kusur(?:\s+\S+)?\s*(?:yoktur|yok)/gi, " ")
    .replace(/çizik(?:\s+dahi)?\s*(?:yoktur|yok)/gi, " ");
}

function hasFeatureInText(text: string, positivePatterns: RegExp[], negativePatterns: RegExp[]): boolean {
  const cleaned = cleanDescriptionForEquipment(text).toLocaleLowerCase("tr-TR");

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

  // NOT: Türkiye pazarında distribütörler (Doğuş, Borusan vb.) araç donanımlarını
  // ÖTV dilimi ve kâr marjı nedeniyle kırparak getirdiğinden, hiçbir araçta genel
  // yıl/marka varsayımı ile kafadan 'Şerit Takip', 'Kör Nokta', '360 Kamera' gibi
  // donanımlar DOĞRULANMAZ. Yalnızca ilanda açıkça yazıyorsa veya Türkiye resmi
  // paket kataloğunda (TRIM_PACKAGES_CATALOG) o paketin standardıysa doğrulanır.
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
    positive: [/şerit takip/i, /şerit koruma/i, /lane assist/i, /lane keeping/i, /şeritte kalma/i],
    negative: [/şerit takip(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "blindSpot",
    name: "Kör Nokta Uyarı Sistemi",
    positive: [/kör nokta/i, /blind spot/i, /kör nokta asistanı/i, /side assist/i, /lane change assist/i],
    negative: [/kör nokta(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "emergencyBrake",
    name: "Çarpışma Önleme & Acil Fren",
    positive: [/çarpışma önle/i, /front assist/i, /acil fren/i, /pre-safe/i, /acil durum.*asistanı/i, /yaya koruma/i, /active brake assist/i, /warn and brake/i],
    negative: [/çarpışma(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "adaptiveCruise",
    name: "Adaptif Hız Sabitleyici (ACC)",
    positive: [/adaptif (hız|cruise)/i, /acc\b/i, /distronic/i, /otonom sürüş/i, /mesafe takip/i, /innodrive/i],
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
    positive: [/koltuk.*ısıtma/i, /ısıtmalı.*koltuk/i, /seat heating/i, /ısıtmalı ön koltuk/i, /ön koltuk ısıtma/i],
    negative: [/(?:koltuk\s*ısıtma|ısıtmalı\s*koltuk)(?:\s+\S+){0,3}\s+(?:yok|hariç|bulunm)/i],
  },
  {
    id: "seatCooling",
    name: "Koltuk Soğutma / Havalandırma",
    positive: [/koltuk.*soğutma/i, /soğutmalı.*koltuk/i, /koltuk havalandırma/i, /seat ventilation/i],
    negative: [/(?:koltuk\s*soğutma|soğutmalı\s*koltuk)(?:\s+\S+){0,3}\s+(?:yok|hariç|bulunm)/i],
  },
  {
    id: "electricSeats",
    name: "Elektrikli & Hafızalı Koltuklar",
    positive: [/hafızalı koltuk/i, /elektrikli koltuk/i, /memory seat/i, /elektrikli.*hafızalı/i, /spor koltuk/i],
    negative: [/(?:elektrikli|hafızalı)\s*koltuk(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
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
    positive: [/anahtarsız/i, /keyless/i, /start.*stop tuş/i, /start-stop düğme/i, /eller serbest giriş/i, /comfort access/i],
    negative: [/anahtarsız(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "digitalCockpit",
    name: "Hayalet Gösterge (Dijital Kokpit)",
    positive: [/hayalet (ekran|gösterge)/i, /dijital (gösterge|kokpit)/i, /virtual cockpit/i, /hyperscreen/i, /live cockpit/i, /kavisli ekran/i],
    negative: [/(?:hayalet|dijital\s*gösterge)(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "heatedSteering",
    name: "Isıtmalı Direksiyon",
    positive: [/ısıtmalı direksiyon/i, /direksiyon ısıtma/i, /heated steering/i],
    negative: [/direksiyon ısıtma(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "ambientLighting",
    name: "İç Ambiyans Aydınlatma",
    positive: [/ambiyans/i, /ortam aydınlatma/i, /ambient lighting/i, /64 renk/i, /iç ışık paketi/i],
    negative: [/ambiyans(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
];

const EXTERIOR_FEATURES: FeatureDefinition[] = [
  {
    id: "camera360",
    name: "360° Çevre Görüş Kamerası",
    positive: [
      /360.*(kamera|derece|görüş)/i,
      /çevre görüş/i,
      /surround view/i,
      /kuşbakışı kamera/i,
      /area view/i,
      /aktif park.*çevre görüş/i,
    ],
    negative: [/(?:360|çevre\s*görüş)(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "rearCamera",
    name: "Geri Görüş Kamerası",
    positive: [/geri görüş/i, /rear camera/i, /park kamerası/i, /arka kamera/i],
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
      /panoramik(?:\s+cam)?\s*tavan/i,
      /cam tavan/i,
      /sunroof/i,
      /panoroma/i,
      /açılır tavan/i,
    ],
    negative: [
      /(?:cam\s*tavan|sunroof|panoramik)(?:\s+\S+){0,3}\s+(?:yok|hariç|bulunm)/i,
      /(?:hariç|olmayan)\s*:\s*(?:cam\s*tavan|sunroof)/i,
    ],
  },
  {
    id: "ledMatrixHeadlights",
    name: "LED / Matrix LED Farlar",
    positive: [
      /matrix\s*led/i,
      /led\s*matrix/i,
      /digital\s*light/i,
      /multibeam/i,
      /laser\s*light/i,
      /iq\.light/i,
      /led\s*far/i,
      /bi-xenon/i,
      /dynamic\s*far/i,
      /pdls/i,
    ],
    negative: [/(?:matrix|led\s*far)(?:\s+\S+){0,3}\s+(?:yok|hariç)/i, /halojen far/i],
  },
  {
    id: "electricTailgate",
    name: "Elektrikli / Eller Serbest Bagaj",
    positive: [
      /elektrikli bagaj/i,
      /otomatik bagaj/i,
      /eller serbest bagaj/i,
      /ayakla açılan bagaj/i,
      /power tailgate/i,
      /easy open/i,
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
    positive: [/yağmur sensör/i, /far sensör/i, /otomatik yanan far/i, /ışık sensör/i],
    negative: [/yağmur sensör(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
];

const MULTIMEDIA_FEATURES: FeatureDefinition[] = [
  {
    id: "carplayAndroidAuto",
    name: "Apple CarPlay & Android Auto",
    positive: [/carplay/i, /android auto/i, /akıllı telefon entegrasyon/i, /mirrorlink/i, /smartlink/i],
    negative: [/(?:carplay|android\s*auto)(?:\s+\S+){0,3}\s+(?:yok|hariç)/i],
  },
  {
    id: "wirelessCharging",
    name: "Kablosuz Şarj (Wireless Charge)",
    positive: [/kablosuz şarj/i, /wireless charg/i, /kablosuz telefon şarj/i, /indüksiyon şarj/i],
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
      /harman kardon/i,
      /bose\b/i,
      /bang & olufsen/i,
      /meridian/i,
      /focal/i,
      /jbl/i,
      /dynaudio/i,
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
