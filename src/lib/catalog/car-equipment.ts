/**
 * Doğrulanmış Araç Donanım Matrisi ve Kural Motoru
 *
 * Satıcıların ilan açıklamalarına hatalı/şablon donanım yazmasını önlemek için;
 * - Dönem/Yıl kısıtlamaları (Era feasibility rules)
 * - Segment/Kasa kısıtlamaları (Gatekeeper rules)
 * - Resmi Donanım Paketleri Broşür Kuralları (Volkswagen Trendline vs Highline, Egea Easy vs Lounge, Chery Luxury vs Excellence vb.)
 * - Olumsuzluk / Negation filtreleri ("...hariç", "...yok", "...bulunmamaktadır")
 * - Fabrika standart baz donanım kuralları (Ultra-lüks/Modern amiral gemisi doğrulaması)
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
      // 360 kamera seri üretimde 2012 öncesinde yoktu.
      if (year < 2013) return false;
      // Ticari hafif araçlarda (Tourneo, Doblo, Fiorino vb.) ve bütçe araçlarda fabrika 360 kamera yoktur
      if (isCommercialVan && year < 2024) return false;
      if (isBudgetEconomy) return false;
      // 2013-2017 arası yalnızca lüks üst segmentte vardı
      if (year < 2018 && !isLuxuryBrand && !/tiggo|omoda/i.test(hay)) return false;
      return true;

    case "seatCooling":
      // Koltuk soğutma yüksek segment lüks donanımdır.
      if (isCommercialVan || isBudgetEconomy) return false;
      // Normal bineklerde bile yalnızca E segment / üst SUV ve amiral gemilerinde bulunur (Chery Excellence, Skoda L&K, Tucson Elite vb.)
      if (!isLuxuryBrand && !/tiggo.*excellence|laurin|l&k|tucson|sportage prestige/i.test(hay) && year < 2022) return false;
      return true;

    case "carplayAndroidAuto":
      // Apple CarPlay ve Android Auto 2015 yılı öncesinde fabrikasyon olarak mevcut değildi.
      if (year < 2015) return false;
      return true;

    case "digitalCockpit":
      // Dijital kokpit/hayalet ekran 2014 öncesinde yoktu (Audi TT 2014 / S-Class 2013).
      if (year < 2014) return false;
      if (isCommercialVan && year < 2022) return false;
      if (isBudgetEconomy && year < 2022) return false;
      if (year < 2017 && !isLuxuryBrand && !/passat|golf/i.test(hay)) return false;
      return true;

    case "laneAssist":
    case "blindSpot":
    case "emergencyBrake":
      // ADAS sistemleri 2012 öncesi kitle araçlarında bulunmaz
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
      // Otomotivde Qi kablosuz şarj 2016 öncesinde mevcut değildi
      if (year < 2016) return false;
      return true;

    case "ledMatrixHeadlights":
      // Matrix LED farlar (Audi Matrix 2014+) 2014 öncesi üretilmedi
      if (year < 2014) return false;
      if (isCommercialVan && year < 2023) return false;
      if (isBudgetEconomy && year < 2024) return false;
      return true;

    case "electricTailgate":
      if (year < 2010) return false;
      if (isCommercialVan) return false; // Tourneo/Doblo gibi ticari araçlar elle açılan tek parça bagaja sahiptir
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
 * Açıklamadan özellik ararken olumsuzluk kontrolü
 * (Örn: "koltuk ısıtma yok", "cam tavan hariç", "sunroof yoktur", "360 hariç")
 */
function hasFeatureInText(text: string, positivePatterns: RegExp[], negativePatterns: RegExp[]): boolean {
  const lower = text.toLowerCase();

  // Olumsuz bir ifade var mı?
  for (const neg of negativePatterns) {
    if (neg.test(lower)) return false;
  }

  // Olumlu bir eşleşme var mı?
  for (const pos of positivePatterns) {
    if (pos.test(lower)) return true;
  }

  return false;
}

/**
 * Fabrika Çıkışı Standart Donanım Belirleme
 * Ultra lüks elektrikli veya modern amiral gemisi araçlarda ilanda açıklama olmasa dahi
 * fabrikasyon standart gelen temel özellikleri doğrular.
 */
function isStandardFactoryEquipment(featureId: string, car: EvaluatedCarInfo): boolean {
  const brand = (car.brand || "").toLowerCase();
  const model = (car.model || "").toLowerCase();
  const year = car.year || 2020;

  const isUltraLuxury =
    /eqs|eqe|s-class|s serisi|taycan|panamera|macan.*elek|bmw 7|i7|bmw 8|audi e-tron|audi a8|model s|model x/i.test(`${brand} ${model}`);
  const isModernLuxury =
    year >= 2019 && /porsche|mercedes|bmw|audi|volvo|lexus/i.test(brand);
  const isModernMainstream =
    year >= 2020 && !/tourneo|connect|courier|doblo|fiorino/i.test(`${brand} ${model}`);

  // ABS & ESP: 2004 sonrası çoğu araçta, 2014 sonrası Avrupa'da tüm onaylı araçlarda yasal standarttır
  if (featureId === "absEsp") return year >= 2004;

  // En az 6 hava yastığı: Lüks araçlarda standart, modern bineklerde standart
  if (featureId === "airbags") {
    if (isUltraLuxury || isModernLuxury) return true;
    if (isModernMainstream && year >= 2021) return true;
    return false;
  }

  // ISOFIX: 2007 sonrası binek araçlarda ve hafif ticarilerde standart
  if (featureId === "isofix") return year >= 2012;

  // Lastik basınç: 2014 sonrası Avrupa tipi tüm onaylı araçlarda standart
  if (featureId === "tirePressure") return year >= 2015;

  // Yokuş kalkış desteği
  if (featureId === "hillHolder") {
    if (isUltraLuxury || isModernLuxury) return true;
    if (year >= 2016) return true;
    return false;
  }

  // Ultra Lüks Amiral Gemisi Standartları (EQS, Macan Electric vb.)
  if (isUltraLuxury) {
    switch (featureId) {
      case "laneAssist":
      case "blindSpot":
      case "emergencyBrake":
      case "adaptiveCruise":
      case "seatHeating":
      case "electricSeats":
      case "leatherSeats":
      case "digitalClimate":
      case "keylessGo":
      case "digitalCockpit":
      case "ambientLighting":
      case "camera360":
      case "parkingSensors":
      case "rearCamera":
      case "ledMatrixHeadlights":
      case "electricTailgate":
      case "foldingMirrors":
      case "rainSensor":
      case "carplayAndroidAuto":
      case "wirelessCharging":
      case "touchScreen":
      case "navigation":
      case "bluetooth":
        return true;
      default:
        break;
    }
  }

  // Modern Lüks (2019+ BMW 3/5, Mercedes C/E, Audi A4/A6)
  if (isModernLuxury) {
    switch (featureId) {
      case "digitalClimate":
      case "keylessGo":
      case "digitalCockpit":
      case "parkingSensors":
      case "rearCamera":
      case "foldingMirrors":
      case "rainSensor":
      case "carplayAndroidAuto":
      case "touchScreen":
      case "bluetooth":
        return true;
      default:
        break;
    }
  }

  return false;
}

/**
 * Donanım Özellikleri Sözlüğü ve Doğrulama Kuralları
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
    negative: [/abs.*yok/i, /esp.*yok/i],
  },
  {
    id: "hillHolder",
    name: "Yokuş Kalkış Desteği",
    positive: [/yokuş kalkış/i, /hill holder/i, /hill assist/i, /auto hold/i],
    negative: [/yokuş kalkış.*yok/i, /hill.*yok/i],
  },
  {
    id: "laneAssist",
    name: "Şerit Takip Sistemi",
    positive: [/şerit takip/i, /şerit koruma/i, /lane assist/i, /lane keeping/i, /şeritte kalma/i],
    negative: [/şerit takip.*yok/i, /şerit takip hariç/i],
  },
  {
    id: "blindSpot",
    name: "Kör Nokta Uyarı Sistemi",
    positive: [/kör nokta/i, /blind spot/i, /kör nokta asistanı/i, /side assist/i],
    negative: [/kör nokta.*yok/i, /kör nokta hariç/i],
  },
  {
    id: "emergencyBrake",
    name: "Çarpışma Önleme & Acil Fren",
    positive: [/çarpışma önle/i, /front assist/i, /acil fren/i, /pre-safe/i, /acil durum.*asistanı/i, /yaya koruma/i, /active brake assist/i],
    negative: [/çarpışma.*yok/i],
  },
  {
    id: "adaptiveCruise",
    name: "Adaptif Hız Sabitleyici (ACC)",
    positive: [/adaptif (hız|cruise)/i, /acc\b/i, /distronic/i, /otonom sürüş/i, /mesafe takip/i],
    negative: [/adaptif.*yok/i, /acc.*yok/i, /distronic.*yok/i],
  },
  {
    id: "airbags",
    name: "Hava Yastığı (En Az 6 Airbag)",
    positive: [/\b(6|8|10|12)\s*(hava yastığı|airbag)/i, /perde hava yastık/i, /yan hava yastık/i, /çoklu airbag/i],
    negative: [/airbag.*yok/i],
  },
  {
    id: "isofix",
    name: "ISOFIX Çocuk Koltuğu",
    positive: [/isofix/i, /çocuk koltuğu sabitleme/i],
    negative: [/isofix.*yok/i],
  },
  {
    id: "tirePressure",
    name: "Lastik Basınç Uyarı Sistemi",
    positive: [/lastik basınç/i, /tpms/i, /tire pressure/i, /lastik arıza/i],
    negative: [/lastik basınç.*yok/i],
  },
];

const COMFORT_FEATURES: FeatureDefinition[] = [
  {
    id: "seatHeating",
    name: "Koltuk Isıtma (Ön/Arka)",
    positive: [/koltuk.*ısıtma/i, /ısıtmalı.*koltuk/i, /seat heating/i, /ısıtmalı ön koltuk/i, /ön koltuk ısıtma/i],
    negative: [/koltuk ısıtma.*yok/i, /koltuk ısıtma.*hariç/i, /ısıtma.*yok/i],
  },
  {
    id: "seatCooling",
    name: "Koltuk Soğutma / Havalandırma",
    positive: [/koltuk.*soğutma/i, /soğutmalı.*koltuk/i, /koltuk havalandırma/i, /seat ventilation/i],
    negative: [/koltuk soğutma.*yok/i, /koltuk soğutma.*hariç/i, /soğutma.*yok/i],
  },
  {
    id: "electricSeats",
    name: "Elektrikli & Hafızalı Koltuklar",
    positive: [/hafızalı koltuk/i, /elektrikli koltuk/i, /memory seat/i, /elektrikli.*hafızalı/i],
    negative: [/hafızalı.*yok/i, /elektrikli koltuk.*yok/i],
  },
  {
    id: "leatherSeats",
    name: "Deri Koltuk Döşeme",
    positive: [/deri koltuk/i, /deri döşeme/i, /leather/i, /alcantara/i, /nappa/i, /artico/i],
    negative: [/deri koltuk.*yok/i, /kumaş döşeme/i],
  },
  {
    id: "digitalClimate",
    name: "Çok Bölgeli Dijital Klima",
    positive: [/dijital klima/i, /çift bölge/i, /dört bölge/i, /climatronic/i, /thermotronic/i, /otomatik klima/i],
    negative: [/dijital klima.*yok/i, /manuel klima/i],
  },
  {
    id: "keylessGo",
    name: "Anahtarsız Giriş & Çalıştırma",
    positive: [/anahtarsız/i, /keyless/i, /start.*stop tuş/i, /start-stop düğme/i, /eller serbest giriş/i],
    negative: [/anahtarsız.*yok/i, /keyless.*yok/i],
  },
  {
    id: "digitalCockpit",
    name: "Hayalet Gösterge (Dijital Kokpit)",
    positive: [/hayalet (ekran|gösterge)/i, /dijital (gösterge|kokpit)/i, /virtual cockpit/i, /hyperscreen/i, /live cockpit/i],
    negative: [/hayalet.*yok/i, /dijital gösterge.*yok/i],
  },
  {
    id: "heatedSteering",
    name: "Isıtmalı Direksiyon",
    positive: [/ısıtmalı direksiyon/i, /direksiyon ısıtma/i, /heated steering/i],
    negative: [/direksiyon ısıtma.*yok/i, /ısıtmalı direksiyon.*hariç/i],
  },
  {
    id: "ambientLighting",
    name: "İç Ambiyans Aydınlatma",
    positive: [/ambiyans/i, /ortam aydınlatma/i, /ambient lighting/i, /64 renk/i, /iç ışık paketi/i],
    negative: [/ambiyans.*yok/i],
  },
];

const EXTERIOR_FEATURES: FeatureDefinition[] = [
  {
    id: "camera360",
    name: "360° Çevre Görüş Kamerası",
    positive: [/360.*(kamera|derece|görüş)/i, /çevre görüş/i, /surround view/i, /kuşbakışı kamera/i, /area view/i],
    negative: [/360.*kamera.*yok/i, /360.*hariç/i, /360 derece.*hariç/i],
  },
  {
    id: "rearCamera",
    name: "Geri Görüş Kamerası",
    positive: [/geri görüş/i, /rear camera/i, /park kamerası/i, /arka kamera/i],
    negative: [/geri görüş.*yok/i, /kamera.*yok/i],
  },
  {
    id: "parkingSensors",
    name: "Ön & Arka Park Sensörü",
    positive: [/park sensör/i, /ön.*arka park/i, /parktronik/i, /parktronic/i, /park pilot/i],
    negative: [/park sensör.*yok/i],
  },
  {
    id: "sunroof",
    name: "Panoramik Cam Tavan / Sunroof",
    positive: [/cam tavan/i, /panoramik/i, /sunroof/i, /panoroma/i, /açılır tavan/i],
    negative: [/cam tavan.*yok/i, /sunroof.*yok/i, /cam tavan hariç/i, /sunroof hariç/i],
  },
  {
    id: "ledMatrixHeadlights",
    name: "LED / Matrix LED Farlar",
    positive: [/matrix led/i, /digital light/i, /multibeam/i, /laser light/i, /iq\.light/i, /led far/i, /bi-xenon/i],
    negative: [/led far.*yok/i, /halojen far/i],
  },
  {
    id: "electricTailgate",
    name: "Elektrikli / Eller Serbest Bagaj",
    positive: [/elektrikli bagaj/i, /otomatik bagaj/i, /eller serbest bagaj/i, /ayakla açılan bagaj/i, /power tailgate/i, /easy open/i],
    negative: [/elektrikli bagaj.*yok/i],
  },
  {
    id: "foldingMirrors",
    name: "Elektrikli Katlanır Yan Aynalar",
    positive: [/katlanır ayna/i, /otomatik katlanan ayna/i, /elektrikli katlanır/i],
    negative: [/katlanır ayna.*yok/i],
  },
  {
    id: "rainSensor",
    name: "Yağmur & Far Sensörü",
    positive: [/yağmur sensör/i, /far sensör/i, /otomatik yanan far/i, /ışık sensör/i],
    negative: [/yağmur sensör.*yok/i],
  },
];

const MULTIMEDIA_FEATURES: FeatureDefinition[] = [
  {
    id: "carplayAndroidAuto",
    name: "Apple CarPlay & Android Auto",
    positive: [/carplay/i, /android auto/i, /akıllı telefon entegrasyon/i, /mirrorlink/i, /smartlink/i],
    negative: [/carplay.*yok/i, /android auto.*yok/i],
  },
  {
    id: "wirelessCharging",
    name: "Kablosuz Şarj (Wireless Charge)",
    positive: [/kablosuz şarj/i, /wireless charg/i, /kablosuz telefon şarj/i, /indüksiyon şarj/i],
    negative: [/kablosuz şarj.*yok/i],
  },
  {
    id: "touchScreen",
    name: "Dokunmatik Multimedya Ekranı",
    positive: [/dokunmatik ekran/i, /multimedya ekran/i, /touchscreen/i, /büyük ekran/i, /merkezi ekran/i, /hyperscreen/i, /tablet ekran/i],
    negative: [/ekran.*yok/i],
  },
  {
    id: "navigation",
    name: "Dahili Navigasyon Sistemi",
    positive: [/navigasyon/i, /harita sistemi/i, /gps/i, /mbux navigasyon/i],
    negative: [/navigasyon.*yok/i, /navigasyon hariç/i],
  },
  {
    id: "bluetooth",
    name: "Bluetooth & Eller Serbest",
    positive: [/bluetooth/i, /eller serbest konuşma/i, /handsfree/i, /telefon bağlantı/i],
    negative: [/bluetooth.*yok/i],
  },
  {
    id: "premiumAudio",
    name: "Premium Ses Sistemi",
    positive: [/burmester/i, /harman kardon/i, /bose\b/i, /bang & olufsen/i, /meridian/i, /focal/i, /jbl/i, /dynaudio/i, /ses sistemi/i],
    negative: [/ses sistemi.*yok/i],
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
        const isExplicitlyNegated = def.negative.some((neg) => neg.test(text.toLowerCase()));
        if (!isExplicitlyNegated) {
          return { id: def.id, name: def.name, present: true };
        }
      }

      // 4. Fabrika çıkışı standart donanım teyidi (Amiral gemisi / lüks)
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
