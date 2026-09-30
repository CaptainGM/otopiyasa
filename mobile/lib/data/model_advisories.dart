class ModelAdvisory {
  final String id;
  final String title;
  final RegExp brandMatch;
  final RegExp engineMatch;
  final String advice;
  final String checkItem;
  final bool isWarning;

  const ModelAdvisory({
    required this.id,
    required this.title,
    required this.brandMatch,
    required this.engineMatch,
    required this.advice,
    required this.checkItem,
    this.isWarning = false,
  });
}

final List<ModelAdvisory> curatedAdvisories = [
  ModelAdvisory(
    id: 'psa_puretech_12',
    title: '1.2 PureTech Motor (Islak Triger)',
    brandMatch: RegExp(r'peugeot|citroen|citroën|opel|ds', caseSensitive: false),
    engineMatch: RegExp(r'1\.2|puretech', caseSensitive: false),
    advice:
        'Bu motor serisinde triger kayışı motor yağı içerisinde çalışır. Yetkili servis onaylı doğru viskozitede yağ kullanılmış olması, periyodik bakım geçmişi ve yağ karter süzgeci kontrolü tavsiye edilir.',
    checkItem: 'Triger kayışı aşınma durumu ve yetkili servis yağ kayıtları',
    isWarning: true,
  ),
  ModelAdvisory(
    id: 'vag_dsg_dq200',
    title: 'VAG Grubu 7 İleri Kuru Kavrama (DSG / S-Tronic)',
    brandMatch: RegExp(r'volkswagen|audi|seat|skoda', caseSensitive: false),
    engineMatch: RegExp(r'1\.6\s*tdi|1\.4\s*tsi|1\.2\s*tsi|1\.0\s*tsi|dsg', caseSensitive: false),
    advice:
        'Kuru kavrama (DQ200) otomatik şanzımanlarda, test sürüşü esnasında 1. ve 2. vites geçişlerinde titreme, yokuş kalkış kararlılığı ve mekatronik tepkilerinin kontrol edilmesi önerilir.',
    checkItem: 'Kavrama baskı balata durumu ve mekatronik yağ kaçakları',
    isWarning: true,
  ),
  ModelAdvisory(
    id: 'fiat_multijet_13',
    title: '1.3 Multijet / CDTI Dizel Motor',
    brandMatch: RegExp(r'fiat|opel', caseSensitive: false),
    engineMatch: RegExp(r'1\.3|multijet|cdti', caseSensitive: false),
    advice:
        'Dayanıklılığıyla bilinen bu motorda, özellikle 150.000 km üzerindeki araçlarda soğuk marşta triger zincir sesi ve karter yağ pompası basıncı kontrol edilmelidir.',
    checkItem: 'Triger zinciri gergi durumu ve yağlama periyodu',
  ),
  ModelAdvisory(
    id: 'fiat_fire_14',
    title: '1.4 Fire Atmosferik Benzinli Motor',
    brandMatch: RegExp(r'fiat', caseSensitive: false),
    engineMatch: RegExp(r'1\.4\s*fire|1\.4|egea', caseSensitive: false),
    advice:
        'Basit ve sorunsuz yapısıyla bilinen 1.4 Fire motorlarda, yüksek devirli uzun yol kullanımlarında doğal yağ eksiltme eğilimi görülebilir. Yağ çubuğu seviyesi ve düzenli bakım geçmişi incelenmelidir.',
    checkItem: 'Motor yağ seviyesi ve buji/ateşleme bobini durumu',
  ),
  ModelAdvisory(
    id: 'renault_dci_15',
    title: '1.5 dCi Dizel Motor',
    brandMatch: RegExp(r'renault|dacia|nissan|mercedes', caseSensitive: false),
    engineMatch: RegExp(r'1\.5|dci', caseSensitive: false),
    advice:
        'Piyasanın en tutulan ve ekonomik dizel motorlarından biridir. Yüksek kilometreli araçlarda enjektör püskürtme değerleri, turbo hortumları ve partikül filtresi (DPF) doluluk oranı incelenmelidir.',
    checkItem: 'Enjektör geri dönüş değerleri ve turbo basınç testi',
  ),
  ModelAdvisory(
    id: 'renault_tce_12',
    title: '1.2 TCe Turbo Benzinli Motor (2012-2016)',
    brandMatch: RegExp(r'renault|dacia|nissan', caseSensitive: false),
    engineMatch: RegExp(r'1\.2\s*tce', caseSensitive: false),
    advice:
        'Bu motor jenerasyonunda periyodik aralıklarla motor yağı eksiltme durumu görülebilmektedir. Araç geçmişinde motor revizyonu veya segman kontrolü yapılıp yapılmadığını sorgulayınız.',
    checkItem: 'Silindir kompresyon testi ve yağ tüketim geçmişi',
    isWarning: true,
  ),
  ModelAdvisory(
    id: 'ford_ecoboost_10',
    title: '1.0 EcoBoost Motor (Islak Triger)',
    brandMatch: RegExp(r'ford', caseSensitive: false),
    engineMatch: RegExp(r'1\.0|ecoboost', caseSensitive: false),
    advice:
        '1.0 EcoBoost ünitelerde triger kayışı yağ içinde çalışır ve degas (soğutma) hortumu yapısı kritiktir. Antifriz tipi ve üretici onaylı yağ kullanılmış olması büyük önem taşır.',
    checkItem: 'Soğutma sistemi hortumları ve ıslak triger değişim zamanı',
    isWarning: true,
  ),
  ModelAdvisory(
    id: 'bmw_n47_20d',
    title: 'BMW 2.0d N47 Dizel Motor',
    brandMatch: RegExp(r'bmw', caseSensitive: false),
    engineMatch: RegExp(r'2\.0|n47|520d|320d|120d', caseSensitive: false),
    advice:
        'Motorun arka tarafında bulunan triger zincir seti, yüksek kilometreli araçlarda uzama yapabilir. Soğuk ilk marşta motorun arkasından şıngırtı/sürtünme sesi gelip gelmediği dinlenmelidir.',
    checkItem: 'Triger zinciri boşluk ve ses kontrolü (soğuk marş)',
    isWarning: true,
  ),
];

ModelAdvisory? findMobileModelAdvisory(String brand, String model) {
  final combined = '$brand $model'.trim();
  for (final advisory in curatedAdvisories) {
    if (advisory.brandMatch.hasMatch(brand) || advisory.brandMatch.hasMatch(combined)) {
      if (advisory.engineMatch.hasMatch(model) || advisory.engineMatch.hasMatch(combined)) {
        return advisory;
      }
    }
  }
  return null;
}
