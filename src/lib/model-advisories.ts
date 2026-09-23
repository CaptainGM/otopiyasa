/**
 * Türkiye ikinci el otomotiv pazarında yaygın olarak bilinen ve kabul gören
 * motor / şanzıman kombinasyonları için doğrulanmış satın alma öncesi tavsiyeler.
 *
 * NOT: Yapay zekaya serbest üretim yaptırılmaz; uydurma veya haksız kötüleme
 * riskini önlemek için yalnızca sektörce bilinen nesnel ekspertiz ipuçları verilir.
 */

export interface ModelAdvisory {
  id: string;
  title: string;
  engineMatch: RegExp;
  brandMatch: RegExp;
  advice: string;
  severity: "info" | "warning";
  checkItem: string;
}

export const CURATED_ADVISORIES: ModelAdvisory[] = [
  {
    id: "psa_puretech_12",
    title: "1.2 PureTech Motor (Islak Triger)",
    brandMatch: /peugeot|citroen|citroën|opel|ds/i,
    engineMatch: /1\.2|puretech/i,
    advice:
      "Bu motor serisinde triger kayışı motor yağı içerisinde çalışmaktadır (ıslak triger). Yetkili servis onaylı doğru viskozitede yağ kullanılmış olması, periyodik bakım geçmişi ve yağ karteri süzgeci kontrolü tavsiye edilir.",
    severity: "warning",
    checkItem: "Triger kayışı aşınma kontrolü ve yetkili servis yağ kayıtları",
  },
  {
    id: "vag_dsg_dq200",
    title: "VAG Grubu 7 İleri Kuru Kavrama (DSG / S-Tronic)",
    brandMatch: /volkswagen|audi|seat|skoda/i,
    engineMatch: /1\.6\s*tdi|1\.4\s*tsi|1\.2\s*tsi|1\.0\s*tsi|dsg/i,
    advice:
      "Kuru kavrama (DQ200) otomatik şanzımanlarda, test sürüşü esnasında 1. ve 2. vites geçişlerinde titreme, yokuş kalkış kararlılığı ve mekatronik tepkilerinin kontrol edilmesi önerilir.",
    severity: "warning",
    checkItem: "Kavrama baskı balata durumu ve mekatronik yağ kaçakları",
  },
  {
    id: "fiat_multijet_13",
    title: "1.3 Multijet / CDTI Dizel Motor",
    brandMatch: /fiat|opel/i,
    engineMatch: /1\.3|multijet|cdti/i,
    advice:
      "Dayanıklılığıyla bilinen bu motorda, özellikle 150.000 km üzerindeki araçlarda soğuk marşta triger zincir sesi ve karter yağ pompası basıncı kontrol edilmelidir.",
    severity: "info",
    checkItem: "Triger zinciri gergi durumu ve yağlama periyodu",
  },
  {
    id: "fiat_fire_14",
    title: "1.4 Fire Atmosferik Benzinli Motor",
    brandMatch: /fiat/i,
    engineMatch: /1\.4\s*fire|1\.4|egea/i,
    advice:
      "Basit ve sorunsuz yapısıyla bilinen 1.4 Fire motorlarda, yüksek devirli uzun yol kullanımlarında doğal yağ eksiltme eğilimi görülebilir. Yağ çubuğu seviyesi ve düzenli bakım geçmişi incelenmelidir.",
    severity: "info",
    checkItem: "Motor yağ seviyesi ve buji/ateşleme bobini durumu",
  },
  {
    id: "renault_dci_15",
    title: "1.5 dCi Dizel Motor",
    brandMatch: /renault|dacia|nissan|mercedes/i,
    engineMatch: /1\.5|dci/i,
    advice:
      "Piyasanın en tutulan ve ekonomik dizel motorlarından biridir. Yüksek kilometreli araçlarda enjektör püskürtme değerleri, turbo hortumları ve partikül filtresi (DPF) doluluk oranı incelenmelidir.",
    severity: "info",
    checkItem: "Enjektör geri dönüş değerleri ve turbo basınç testi",
  },
  {
    id: "renault_tce_12",
    title: "1.2 TCe Turbo Benzinli Motor (2012-2016)",
    brandMatch: /renault|dacia|nissan/i,
    engineMatch: /1\.2\s*tce/i,
    advice:
      "Bu motor jenerasyonunda periyodik aralıklarla motor yağı eksiltme durumu görülebilmektedir. Araç geçmişinde motor revizyonu veya segman kontrolü yapılıp yapılmadığını sorgulayınız.",
    severity: "warning",
    checkItem: "Silindir kompresyon testi ve yağ tüketim geçmişi",
  },
  {
    id: "ford_ecoboost_10",
    title: "1.0 EcoBoost Motor (Islak Triger)",
    brandMatch: /ford/i,
    engineMatch: /1\.0|ecoboost/i,
    advice:
      "1.0 EcoBoost ünitelerde triger kayışı yağ içinde çalışır ve degas (soğutma) hortumu yapısı kritiktir. Antifriz tipi ve üretici onaylı yağ kullanılmış olması büyük önem taşır.",
    severity: "warning",
    checkItem: "Soğutma sistemi hortumları ve ıslak triger değişim zamanı",
  },
  {
    id: "toyota_valvematic_16",
    title: "Toyota 1.6 Valvematic / VVT-i",
    brandMatch: /toyota/i,
    engineMatch: /1\.6|valvematic|vvt/i,
    advice:
      "Mekanik ömrü ve dayanıklılığı çok yüksektir. Eğer araca sonradan LPG takılmışsa, subap erimesi veya ayar bozulması riskine karşı subap durumunun kontrolü önerilir.",
    severity: "info",
    checkItem: "LPG uyumu ve subap boşluk ayarları",
  },
  {
    id: "honda_vtec_16",
    title: "Honda 1.6 i-VTEC / i-DTEC",
    brandMatch: /honda/i,
    engineMatch: /1\.6|vtec|dtec/i,
    advice:
      "Zincirli eksantrik yapısıyla son derece sorunsuzdur. Otomatik şanzımanlı modellerde orijinal şanzıman yağı değişim periyoduna uyulup uyulmadığı sorgulanmalıdır.",
    severity: "info",
    checkItem: "Otomatik şanzıman yağı değişim geçmişi",
  },
  {
    id: "bmw_n47_20d",
    title: "BMW 2.0d N47 Dizel Motor",
    brandMatch: /bmw/i,
    engineMatch: /2\.0|n47|520d|320d|120d/i,
    advice:
      "Motorun arka tarafında bulunan triger zincir seti, yüksek kilometreli araçlarda uzama yapabilir. Soğuk ilk marşta motorun arkasından şıngırtı/sürtünme sesi gelip gelmediği dinlenmelidir.",
    severity: "warning",
    checkItem: "Triger zinciri boşluk ve ses kontrolü (soğuk marş)",
  },
  {
    id: "vag_tdi_20",
    title: "VAG Grubu 2.0 TDI Dizel Motor",
    brandMatch: /volkswagen|audi|seat|skoda/i,
    engineMatch: /2\.0\s*tdi/i,
    advice:
      "Çok güçlü ve uzun ömürlü bir motordur. Şehir içi kısa mesafe kullanılmış araçlarda DPF (Dizel Partikül Filtresi) ve EGR valfi kurum doluluğu kontrol edilmelidir.",
    severity: "info",
    checkItem: "DPF kurum doluluk gramajı ve EGR valf sağlığı",
  },
];

/**
 * Verilen marka ve model metnine göre eşleşen satın alma öncesi tavsiyeyi döndürür.
 * Eşleşme yoksa null döner (uydurma yapılmaz).
 */
export function findModelAdvisory(
  brand: string,
  model: string,
  extraText?: string
): ModelAdvisory | null {
  const combined = `${brand} ${model} ${extraText || ""}`.trim();

  for (const advisory of CURATED_ADVISORIES) {
    if (advisory.brandMatch.test(brand) || advisory.brandMatch.test(combined)) {
      if (advisory.engineMatch.test(model) || advisory.engineMatch.test(combined)) {
        return advisory;
      }
    }
  }

  return null;
}
