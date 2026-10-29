/**
 * Türkiye Otomobil Pazarı Donanım Paketleri & Fabrika Broşür Matrisi
 *
 * Her markanın resmi satış broşürlerindeki donanım paketlerini (Trim levels)
 * ve paketlerin standart sunduğu veya kesinlikle içermediği donanımları içerir.
 */

export interface PackageEquipmentRules {
  /** Pakette fabrikasyon kesin olan özellik kimlikleri */
  standardFeatures: string[];
  /** Pakette fabrikasyon kesinlikle OLMAYAN / bulunmayan özellik kimlikleri */
  excludedFeatures?: string[];
}

interface PackageDefinition {
  brandRegex: RegExp;
  modelRegex?: RegExp;
  packageName: string;
  packageRegex: RegExp;
  yearRange?: [number, number];
  rules: PackageEquipmentRules;
}

/**
 * Türkiye pazarındaki popüler marka ve modellerin resmi paket sözlüğü
 */
export const TRIM_PACKAGES_CATALOG: PackageDefinition[] = [
  // ==========================================
  // 1. VOLKSWAGEN (Polo, Golf, Passat, Tiguan, T-Roc, Taigo, Arteon)
  // ==========================================
  {
    brandRegex: /volkswagen|vw/i,
    packageName: "Trendline / Impression / Midline",
    packageRegex: /\b(trendline|impression|midline|midline\s*plus)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "wirelessCharging", "leatherSeats"],
    },
  },
  {
    brandRegex: /volkswagen|vw/i,
    packageName: "Comfortline / Life / Business",
    packageRegex: /\b(comfortline|life|business)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "parkingSensors", "rainSensor", "digitalClimate", "touchScreen", "bluetooth"],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /volkswagen|vw/i,
    packageName: "Highline / Elegance / Style",
    packageRegex: /\b(highline|elegance|style)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "parkingSensors", "rearCamera",
        "rainSensor", "digitalClimate", "touchScreen", "bluetooth", "ambientLighting",
        "foldingMirrors", "keylessGo", "ledMatrixHeadlights", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /volkswagen|vw/i,
    packageName: "R-Line",
    packageRegex: /\b(r-line|rline|r\s*line)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "parkingSensors", "rearCamera",
        "rainSensor", "digitalClimate", "touchScreen", "bluetooth", "ambientLighting",
        "foldingMirrors", "keylessGo", "ledMatrixHeadlights", "carplayAndroidAuto",
        "digitalCockpit", "sunroof"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 2. RENAULT (Clio, Megane, Symbol, Austral, Captur, Kadjar, Talisman)
  // ==========================================
  {
    brandRegex: /renault/i,
    modelRegex: /austral/i,
    packageName: "Austral Iconic / Techno Esprit Alpine",
    packageRegex: /\b(iconic|esprit\s*alpine)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rainSensor", "parkingSensors", "rearCamera", "camera360", "digitalClimate",
        "keylessGo", "ledMatrixHeadlights", "foldingMirrors", "ambientLighting",
        "carplayAndroidAuto", "digitalCockpit", "electricTailgate", "laneAssist", "blindSpot"
      ],
    },
  },
  {
    brandRegex: /renault/i,
    packageName: "Joy / Authentique / Equilibre",
    packageRegex: /\b(joy|joy\s*plus|authentique|equilibre)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "wirelessCharging", "digitalClimate", "rearCamera", "touchScreen"],
    },
  },
  {
    brandRegex: /renault/i,
    packageName: "Touch / Evolution",
    packageRegex: /\b(touch|touch\s*plus|evolution)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth", "rainSensor", "parkingSensors", "carplayAndroidAuto"],
      excludedFeatures: ["seatCooling", "camera360", "leatherSeats", "sunroof"],
    },
  },
  {
    brandRegex: /renault/i,
    packageName: "Icon / Intens / Techno / RS Line / Esprit Alpine",
    packageRegex: /\b(icon|intens|techno|rs\s*line|esprit\s*alpine)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rainSensor", "parkingSensors", "rearCamera", "digitalClimate", "keylessGo",
        "ledMatrixHeadlights", "foldingMirrors", "ambientLighting", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 3. FIAT (Egea Sedan / HB / Cross, Fiorino, Doblo)
  // ==========================================
  {
    brandRegex: /fiat/i,
    modelRegex: /egea/i,
    packageName: "Easy / Street",
    packageRegex: /\b(easy|easy\s*plus|street)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["touchScreen", "carplayAndroidAuto", "digitalClimate", "sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "rearCamera", "foldingMirrors"],
    },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /egea/i,
    packageName: "Urban",
    packageRegex: /\burban\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen", "carplayAndroidAuto", "digitalClimate", "parkingSensors"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats", "electricTailgate"],
    },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /egea/i,
    packageName: "Lounge / Lounge Plus",
    packageRegex: /\b(lounge|lounge\s*plus)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen",
        "carplayAndroidAuto", "digitalClimate", "parkingSensors", "rearCamera",
        "rainSensor", "digitalCockpit", "keylessGo"
      ],
      excludedFeatures: ["seatCooling", "camera360", "electricTailgate"],
    },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /egea/i,
    packageName: "Limited",
    packageRegex: /\blimited\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen",
        "carplayAndroidAuto", "digitalClimate", "parkingSensors", "rearCamera",
        "rainSensor", "digitalCockpit", "keylessGo", "leatherSeats", "seatHeating", "blindSpot"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /fiorino|doblo/i,
    packageName: "Fiorino / Doblo Pop / Easy",
    packageRegex: /\b(pop|easy|safeline)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix"],
      excludedFeatures: ["touchScreen", "sunroof", "digitalCockpit", "seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /fiorino|doblo/i,
    packageName: "Fiorino / Doblo Premio / Trekking",
    packageRegex: /\b(premio|premio\s*plus|trekking)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "bluetooth", "touchScreen", "parkingSensors"],
      excludedFeatures: ["sunroof", "digitalCockpit", "seatCooling", "camera360", "leatherSeats"],
    },
  },

  // ==========================================
  // 4. TOYOTA (Corolla, Yaris, C-HR, RAV4, Corolla Cross)
  // ==========================================
  {
    brandRegex: /toyota/i,
    packageName: "Vision / Life",
    packageRegex: /\b(vision|vision\s*plus|life)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "wirelessCharging", "rearCamera"],
    },
  },
  {
    brandRegex: /toyota/i,
    packageName: "Dream / Dream X-Pack",
    packageRegex: /\bdream\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen", "rearCamera", "digitalClimate", "carplayAndroidAuto"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /toyota/i,
    packageName: "Flame / Flame X-Pack",
    packageRegex: /\bflame\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen", "rearCamera", "digitalClimate", "carplayAndroidAuto", "keylessGo", "ledMatrixHeadlights", "foldingMirrors", "rainSensor"],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /toyota/i,
    packageName: "Passion / Passion X-Pack / GR Sport",
    packageRegex: /\b(passion|gr\s*sport)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen",
        "rearCamera", "digitalClimate", "carplayAndroidAuto", "keylessGo", "ledMatrixHeadlights",
        "foldingMirrors", "rainSensor", "sunroof", "wirelessCharging", "blindSpot", "seatHeating"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 5. HONDA (Civic, City, HR-V, CR-V, Jazz)
  // ==========================================
  {
    brandRegex: /honda/i,
    packageName: "Dream",
    packageRegex: /\bdream\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360"],
    },
  },
  {
    brandRegex: /honda/i,
    modelRegex: /civic/i,
    packageName: "Civic Elegance",
    packageRegex: /\belegance\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "digitalClimate", "rearCamera", "parkingSensors", "sunroof", "seatHeating",
        "rainSensor", "foldingMirrors"
      ],
      excludedFeatures: ["seatCooling", "camera360", "electricTailgate"],
    },
  },
  {
    brandRegex: /honda/i,
    modelRegex: /civic/i,
    packageName: "Civic Executive / Executive Plus / Advance",
    packageRegex: /\b(executive|advance)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "digitalClimate", "rearCamera", "parkingSensors", "sunroof", "seatHeating",
        "rainSensor", "foldingMirrors", "leatherSeats", "keylessGo", "blindSpot",
        "ledMatrixHeadlights", "carplayAndroidAuto", "wirelessCharging"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 6. PEUGEOT (208, 308, 408, 508, 2008, 3008, 5008, Rifter)
  // ==========================================
  {
    brandRegex: /peugeot/i,
    packageName: "Active / Active Prime",
    packageRegex: /\bactive\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth", "parkingSensors", "rainSensor"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "camera360", "wirelessCharging", "leatherSeats"],
    },
  },
  {
    brandRegex: /peugeot/i,
    packageName: "Allure / Allure Selection",
    packageRegex: /\ballure\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "rainSensor", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /peugeot/i,
    packageName: "GT / GT-Line",
    packageRegex: /\b(gt|gt-line|gtline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "rainSensor", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "carplayAndroidAuto", "ledMatrixHeadlights",
        "ambientLighting", "laneAssist", "seatHeating", "blindSpot"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 7. FORD (Focus, Fiesta, Puma, Kuga, Mondeo, Tourneo)
  // ==========================================
  {
    brandRegex: /ford/i,
    modelRegex: /tourneo.*connect|tourneo.*courier|custom/i,
    packageName: "Tourneo Connect / Courier GLX / Deluxe / Trend",
    packageRegex: /\b(glx|deluxe|trend)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "rainSensor"],
      excludedFeatures: ["camera360", "seatCooling", "digitalCockpit", "carplayAndroidAuto", "electricTailgate", "wirelessCharging", "ledMatrixHeadlights", "adaptiveCruise"],
    },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /focus|fiesta|kuga|puma/i,
    packageName: "Trend / Trend X",
    packageRegex: /\b(trend|trend\s*x)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "digitalClimate", "leatherSeats"],
    },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /focus|fiesta|kuga|puma|mondeo|tourneo/i,
    packageName: "Titanium / Titanium Plus",
    packageRegex: /\btitanium\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rainSensor", "digitalClimate", "keylessGo", "foldingMirrors",
        "ambientLighting", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /focus|kuga|puma/i,
    packageName: "ST-Line",
    packageRegex: /\b(st-line|stline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rainSensor", "digitalClimate", "keylessGo", "foldingMirrors",
        "ambientLighting", "carplayAndroidAuto", "digitalCockpit", "ledMatrixHeadlights"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /focus|kuga|mondeo/i,
    packageName: "Vignale",
    packageRegex: /\bvignale\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "rainSensor", "digitalClimate", "keylessGo",
        "foldingMirrors", "ambientLighting", "carplayAndroidAuto", "digitalCockpit",
        "ledMatrixHeadlights", "leatherSeats", "seatHeating", "premiumAudio"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 8. HYUNDAI (i10, i20, Bayon, Elantra, Kona, Tucson, Santa Fe)
  // ==========================================
  {
    brandRegex: /hyundai/i,
    modelRegex: /tucson/i,
    packageName: "Tucson Elite Plus / N-Line",
    packageRegex: /\b(elite\s*plus|n-line|nline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "parkingSensors", "carplayAndroidAuto", "digitalClimate",
        "keylessGo", "digitalCockpit", "sunroof", "leatherSeats", "seatHeating",
        "foldingMirrors", "rainSensor", "ambientLighting", "blindSpot", "laneAssist"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
  {
    brandRegex: /hyundai/i,
    packageName: "Jump",
    packageRegex: /\bjump\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "rearCamera", "touchScreen"],
    },
  },
  {
    brandRegex: /hyundai/i,
    packageName: "Style / Style Plus",
    packageRegex: /\bstyle\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth", "rearCamera", "parkingSensors", "carplayAndroidAuto"],
      excludedFeatures: ["seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /hyundai/i,
    packageName: "Elite / Elite Plus / Prime",
    packageRegex: /\b(elite|prime)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "parkingSensors", "carplayAndroidAuto", "digitalClimate",
        "keylessGo", "digitalCockpit", "sunroof", "foldingMirrors", "rainSensor",
        "ambientLighting"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 9. CHERY (Omoda 5, Tiggo 7 Pro, Tiggo 8 Pro, Tiggo 8 Pro Max)
  // ==========================================
  {
    brandRegex: /chery/i,
    packageName: "Comfort",
    packageRegex: /\bcomfort\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "parkingSensors", "digitalCockpit", "keylessGo"
      ],
      excludedFeatures: ["seatCooling", "seatHeating", "camera360", "sunroof"],
    },
  },
  {
    brandRegex: /chery/i,
    packageName: "Luxury",
    packageRegex: /\bluxury\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "camera360", "rearCamera", "parkingSensors", "sunroof", "digitalCockpit",
        "digitalClimate", "keylessGo", "wirelessCharging", "electricTailgate",
        "leatherSeats", "ledMatrixHeadlights", "foldingMirrors", "rainSensor"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
  {
    brandRegex: /chery/i,
    packageName: "Excellence",
    packageRegex: /\bexcellence\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "camera360", "rearCamera", "parkingSensors", "sunroof", "digitalCockpit",
        "digitalClimate", "keylessGo", "wirelessCharging", "electricTailgate",
        "leatherSeats", "ledMatrixHeadlights", "foldingMirrors", "rainSensor",
        "seatHeating", "seatCooling", "adaptiveCruise", "laneAssist", "blindSpot",
        "emergencyBrake", "premiumAudio", "electricSeats"
      ],
    },
  },

  // ==========================================
  // 10. SKODA (Fabia, Scala, Kamiq, Karoq, Octavia, Superb, Kodiaq)
  // ==========================================
  {
    brandRegex: /skoda/i,
    packageName: "Active / Ambition",
    packageRegex: /\b(active|ambition)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /skoda/i,
    packageName: "Style / Premium / Elite",
    packageRegex: /\b(style|premium|elite)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "carplayAndroidAuto", "ledMatrixHeadlights"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /skoda/i,
    packageName: "Sportline",
    packageRegex: /\bsportline\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "carplayAndroidAuto", "ledMatrixHeadlights",
        "sunroof", "ambientLighting"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /skoda/i,
    packageName: "Laurin & Klement (L&K)",
    packageRegex: /\b(laurin|klement|l&k)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "carplayAndroidAuto", "ledMatrixHeadlights",
        "leatherSeats", "seatHeating", "seatCooling", "premiumAudio", "adaptiveCruise",
        "laneAssist", "blindSpot", "electricTailgate", "ambientLighting"
      ],
    },
  },

  // ==========================================
  // 11. BMW (1, 2, 3, 4, 5, 7, X1, X2, X3, X4, X5, i4, i5, iX)
  // ==========================================
  {
    brandRegex: /bmw/i,
    packageName: "BMW Joy / Standard",
    packageRegex: /\b(joy|standard)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "digitalClimate", "keylessGo", "rainSensor", "ledMatrixHeadlights"
      ],
      excludedFeatures: ["seatCooling", "camera360", "heatedSteering", "electricTailgate", "sunroof"],
    },
  },
  {
    brandRegex: /bmw/i,
    packageName: "BMW Sport Line",
    packageRegex: /\b(sport\s*line|sportline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "navigation"
      ],
      excludedFeatures: ["seatCooling", "camera360", "heatedSteering", "electricTailgate", "laneAssist", "blindSpot"],
    },
  },
  {
    brandRegex: /bmw/i,
    packageName: "BMW Luxury Line",
    packageRegex: /\b(luxury\s*line|luxuryline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "leatherSeats", "electricSeats", "navigation"
      ],
      excludedFeatures: ["seatCooling", "camera360", "heatedSteering"],
    },
  },
  {
    brandRegex: /bmw/i,
    packageName: "BMW M Performance (M135i / M235i / M340i / M440i / M550i / M2 / M3 / M4 / M5)",
    packageRegex: /\b(?:m135i|m235i|m340i|m440i|m550i|m850i|\bm[23458]\b|x[356]\s*m)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "sunroof", "digitalCockpit",
        "carplayAndroidAuto", "navigation", "premiumAudio", "wirelessCharging", "leatherSeats",
        "electricSeats", "seatHeating"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
  {
    brandRegex: /bmw/i,
    packageName: "M Sport / M Sport Pro / M Paket",
    packageRegex: /\b(m\s*sport|msport|m\s*paket)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "sunroof", "digitalCockpit",
        "carplayAndroidAuto", "navigation"
      ],
      excludedFeatures: ["seatCooling", "camera360", "heatedSteering"],
    },
  },

  // ==========================================
  // 12. MERCEDES-BENZ (A, B, C, E, S, CLA, GLA, GLB, GLC, GLE, EQS)
  // ==========================================
  {
    brandRegex: /mercedes/i,
    packageName: "Mercedes Style / Urban",
    packageRegex: /\b(style|urban)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "digitalClimate", "rainSensor", "ledMatrixHeadlights"
      ],
      excludedFeatures: ["seatCooling", "camera360", "sunroof", "electricTailgate"],
    },
  },
  {
    brandRegex: /mercedes/i,
    packageName: "Progressive / Avantgarde",
    packageRegex: /\b(progressive|avantgarde)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "leatherSeats"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /mercedes/i,
    packageName: "Exclusive",
    packageRegex: /\bexclusive\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "leatherSeats", "electricSeats", "navigation", "wirelessCharging", "sunroof"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /mercedes/i,
    packageName: "Mercedes-AMG Performance (35 / 43 / 45 / 53 / 63)",
    packageRegex: /\b(?:amg\s*(?:35|43|45|53|63)|(?:35|43|45|53|63)\s*amg|glc.*(?:43|63)|gle.*(?:53|63)|c\s*63|e\s*63)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "electricSeats", "electricTailgate", "seatHeating", "blindSpot",
        "navigation", "premiumAudio", "wirelessCharging", "sunroof"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
  {
    brandRegex: /mercedes/i,
    packageName: "AMG Line / AMG Paket",
    packageRegex: /\b(amg\s*line|amg\s*paket|amg\s*sport|\bamg\b)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "sunroof", "digitalCockpit",
        "carplayAndroidAuto", "leatherSeats", "navigation", "wirelessCharging"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /eqs|eqe/i,
    packageName: "EQS / EQE Heritage / AMG / Edition 1",
    packageRegex: /\b(heritage|amg|edition\s*1)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "camera360", "rearCamera", "parkingSensors", "sunroof", "digitalCockpit",
        "digitalClimate", "keylessGo", "wirelessCharging", "electricTailgate",
        "leatherSeats", "ledMatrixHeadlights", "foldingMirrors", "rainSensor",
        "seatHeating", "seatCooling", "adaptiveCruise", "laneAssist", "blindSpot",
        "emergencyBrake", "premiumAudio", "electricSeats", "heatedSteering",
        "ambientLighting", "carplayAndroidAuto", "navigation"
      ],
    },
  },

  // ==========================================
  // 13. AUDI (A3, A4, A5, A6, A7, A8, Q2, Q3, Q5, Q7, Q8)
  // ==========================================
  {
    brandRegex: /audi/i,
    packageName: "Audi Design / Advanced",
    packageRegex: /\b(advanced|design)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "digitalClimate", "keylessGo", "foldingMirrors", "rainSensor",
        "ledMatrixHeadlights", "digitalCockpit", "carplayAndroidAuto", "wirelessCharging", "rearCamera"
      ],
      excludedFeatures: ["seatCooling", "heatedSteering", "camera360", "laneAssist", "blindSpot"],
    },
  },
  {
    brandRegex: /audi/i,
    packageName: "Audi Sport / S line",
    packageRegex: /\b(s\s*line|s-line|sline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "sunroof", "wirelessCharging"
      ],
      excludedFeatures: ["seatCooling", "heatedSteering", "camera360"],
    },
  },
  {
    brandRegex: /audi/i,
    packageName: "Audi S / RS Performance",
    packageRegex: /\b(?:rs\s*[3-7]|rs\s*q[38]|s[3-8]|e-tron\s*gt)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "sunroof", "leatherSeats", "electricSeats",
        "seatHeating", "premiumAudio", "blindSpot", "navigation", "wirelessCharging"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 14. OPEL (Corsa, Astra, Mokka, Crossland, Grandland, Insignia)
  // ==========================================
  {
    brandRegex: /opel/i,
    packageName: "Essentia / Edition",
    packageRegex: /\b(essentia|edition)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "wirelessCharging", "leatherSeats"],
    },
  },
  {
    brandRegex: /opel/i,
    packageName: "Enjoy / Elegance",
    packageRegex: /\b(enjoy|elegance)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rainSensor", "digitalClimate", "foldingMirrors", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /opel/i,
    packageName: "GS / GS Line",
    packageRegex: /\b(gs|gs\s*line|gsline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "rainSensor", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
  {
    brandRegex: /opel/i,
    packageName: "Ultimate / Cosmo",
    packageRegex: /\b(ultimate|cosmo)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "rainSensor", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "seatHeating", "heatedSteering", "blindSpot", "leatherSeats"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 15. NISSAN (Qashqai, Juke, X-Trail, Micra)
  // ==========================================
  {
    brandRegex: /nissan/i,
    packageName: "Visia",
    packageRegex: /\bvisia\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "rearCamera", "touchScreen", "digitalClimate"],
    },
  },
  {
    brandRegex: /nissan/i,
    packageName: "Tekna / Design Pack / Sky Pack",
    packageRegex: /\b(tekna|design\s*pack|sky\s*pack)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "parkingSensors", "digitalClimate", "rainSensor", "foldingMirrors",
        "keylessGo", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /nissan/i,
    packageName: "Platinum / Platinum Premium",
    packageRegex: /\bplatinum\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "camera360", "parkingSensors", "digitalClimate", "rainSensor",
        "foldingMirrors", "keylessGo", "sunroof", "leatherSeats", "seatHeating",
        "ledMatrixHeadlights", "carplayAndroidAuto", "blindSpot", "digitalCockpit"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 16. SEAT & CUPRA (Leon, Ibiza, Ateca, Arona, Formentor)
  // ==========================================
  {
    brandRegex: /seat|cupra/i,
    packageName: "Reference",
    packageRegex: /\breference\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "digitalClimate", "touchScreen"],
    },
  },
  {
    brandRegex: /seat|cupra/i,
    packageName: "Style / Style Plus",
    packageRegex: /\bstyle\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rainSensor", "digitalClimate", "foldingMirrors", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /seat|cupra/i,
    packageName: "Xcellence",
    packageRegex: /\bxcellence\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "rainSensor", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /seat|cupra/i,
    packageName: "FR",
    packageRegex: /\bfr\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "rainSensor", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "sunroof"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
  {
    brandRegex: /cupra|seat/i,
    modelRegex: /formentor|ateca|leon/i,
    packageName: "Cupra VZ / Formentor",
    packageRegex: /\b(vz|formentor)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "rainSensor", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "sunroof", "electricTailgate", "leatherSeats", "adaptiveCruise", "laneAssist"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 17. DACIA (Duster, Sandero, Jogger, Lodgy, Dokker)
  // ==========================================
  {
    brandRegex: /dacia/i,
    packageName: "Ambiance / Essential",
    packageRegex: /\b(ambiance|essential)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "touchScreen", "rearCamera", "digitalClimate", "navigation"],
    },
  },
  {
    brandRegex: /dacia/i,
    packageName: "Laureate / Comfort / Expression",
    packageRegex: /\b(laureate|comfort|expression)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen", "carplayAndroidAuto"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /dacia/i,
    packageName: "Prestige / Journey / Extreme",
    packageRegex: /\b(prestige|prestige\s*plus|journey|extreme)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "navigation", "rearCamera", "parkingSensors", "digitalClimate", "carplayAndroidAuto",
        "blindSpot"
      ],
      excludedFeatures: ["seatCooling", "sunroof", "digitalCockpit"],
    },
  },

  // ==========================================
  // 18. KIA (Sportage, Ceed, Stonic, Rio, Cerato, Sorento)
  // ==========================================
  {
    brandRegex: /kia/i,
    packageName: "Cool / Concept / Live",
    packageRegex: /\b(cool|concept|live)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "touchScreen"],
    },
  },
  {
    brandRegex: /kia/i,
    packageName: "Elegance",
    packageRegex: /\belegance\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "carplayAndroidAuto", "rainSensor"
      ],
      excludedFeatures: ["seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /kia/i,
    packageName: "Prestige",
    packageRegex: /\bprestige\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "sunroof", "seatHeating", "leatherSeats"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
  {
    brandRegex: /kia/i,
    packageName: "GT-Line",
    packageRegex: /\b(gt-line|gtline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "rainSensor", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "sunroof", "seatHeating", "seatCooling", "leatherSeats",
        "electricTailgate", "blindSpot", "laneAssist"
      ],
    },
  },

  // ==========================================
  // 19. CITROEN (C3, C4, C4 X, C5 Aircross, Berlingo)
  // ==========================================
  {
    brandRegex: /citroen/i,
    packageName: "Live",
    packageRegex: /\blive\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats", "touchScreen"],
    },
  },
  {
    brandRegex: /citroen/i,
    packageName: "Feel / Feel Bold",
    packageRegex: /\b(feel|feel\s*bold)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rainSensor", "digitalClimate", "carplayAndroidAuto"
      ],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /citroen/i,
    packageName: "Shine / Shine Bold",
    packageRegex: /\b(shine|shine\s*bold)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "blindSpot"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 20. VOLVO (XC40, XC60, XC90, S60, S90, V40, V60)
  // ==========================================
  {
    brandRegex: /volvo/i,
    packageName: "Momentum / Core / Kinetic",
    packageRegex: /\b(momentum|core|kinetic)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "ledMatrixHeadlights", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /volvo/i,
    packageName: "Inscription / Plus / Ultimate / R-Design",
    packageRegex: /\b(inscription|ultimate|plus|r-design|rdesign)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "sunroof", "leatherSeats", "electricSeats", "seatHeating",
        "electricTailgate", "blindSpot", "premiumAudio"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 21. SUZUKI (Swift, Vitara, S-Cross, Jimny)
  // ==========================================
  {
    brandRegex: /suzuki/i,
    packageName: "GL / GL Elegance",
    packageRegex: /\b(gl|gl\s*elegance)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /suzuki/i,
    packageName: "GLX / GLX Premium",
    packageRegex: /\b(glx|glx\s*premium)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "parkingSensors", "digitalClimate", "keylessGo", "ledMatrixHeadlights",
        "foldingMirrors", "rainSensor", "carplayAndroidAuto", "seatHeating", "sunroof", "blindSpot"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 22. JEEP (Renegade, Compass, Cherokee, Wrangler)
  // ==========================================
  {
    brandRegex: /jeep/i,
    packageName: "Longitude",
    packageRegex: /\blongitude\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen", "carplayAndroidAuto"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /jeep/i,
    packageName: "Limited / S-Limited / Trailhawk",
    packageRegex: /\b(limited|s-limited|trailhawk)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ledMatrixHeadlights", "carplayAndroidAuto", "leatherSeats",
        "seatHeating", "sunroof"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 23. LAND ROVER & RANGE ROVER (Evoque, Velar, Sport, Vogue, Defender)
  // ==========================================
  {
    brandRegex: /land\s*rover|range\s*rover/i,
    packageName: "Land Rover Standard / S",
    packageRegex: /\b(standard|\bs\b)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "ledMatrixHeadlights",
        "leatherSeats", "foldingMirrors", "rainSensor", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /land\s*rover|range\s*rover/i,
    packageName: "SE / HSE / Autobiography",
    packageRegex: /\b(se|hse|autobiography|vogue)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo",
        "foldingMirrors", "rainSensor", "ambientLighting", "ledMatrixHeadlights",
        "digitalCockpit", "carplayAndroidAuto", "sunroof", "leatherSeats", "electricSeats",
        "seatHeating", "electricTailgate", "blindSpot", "premiumAudio"
      ],
    },
  },

  // ==========================================
  // 24. MG (ZS, HS, MG4, MG5)
  // ==========================================
  {
    brandRegex: /\bmg\b/i,
    packageName: "MG Comfort",
    packageRegex: /\bcomfort\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth", "parkingSensors", "carplayAndroidAuto"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /\bmg\b/i,
    packageName: "MG Luxury",
    packageRegex: /\bluxury\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "rainSensor", "ledMatrixHeadlights",
        "carplayAndroidAuto", "sunroof", "leatherSeats", "seatHeating", "electricTailgate",
        "laneAssist", "blindSpot"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 25. MINI (Cooper, Cooper S, Countryman, Clubman)
  // ==========================================
  {
    brandRegex: /mini/i,
    packageName: "Mini Classic",
    packageRegex: /\bclassic\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth", "parkingSensors", "rainSensor", "ledMatrixHeadlights", "carplayAndroidAuto"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /mini/i,
    packageName: "Mini Signature / Iconic / JCW",
    packageRegex: /\b(signature|iconic|jcw|john\s*cooper\s*works)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "sunroof", "seatHeating", "leatherSeats", "premiumAudio"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 26. ALFA ROMEO (Giulietta, Tonale, Stelvio, Giulia)
  // ==========================================
  {
    brandRegex: /alfa\s*romeo/i,
    packageName: "Sprint / Ti",
    packageRegex: /\b(sprint|ti)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /alfa\s*romeo/i,
    packageName: "Veloce / Tributo Italiano / Quadrifoglio",
    packageRegex: /\b(veloce|tributo|quadrifoglio)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "ambientLighting", "ledMatrixHeadlights",
        "carplayAndroidAuto", "leatherSeats", "electricSeats", "seatHeating",
        "premiumAudio", "blindSpot"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 27. TOGG (T10X)
  // ==========================================
  {
    brandRegex: /togg/i,
    modelRegex: /t10x/i,
    packageName: "T10X V1",
    packageRegex: /\bv1\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "digitalCockpit",
        "foldingMirrors", "rainSensor", "ledMatrixHeadlights", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360", "sunroof"],
    },
  },
  {
    brandRegex: /togg/i,
    modelRegex: /t10x/i,
    packageName: "T10X V2",
    packageRegex: /\bv2\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "rainSensor", "ledMatrixHeadlights",
        "carplayAndroidAuto", "sunroof", "seatHeating", "wirelessCharging",
        "electricTailgate", "blindSpot", "premiumAudio", "leatherSeats"
      ],
    },
  },

  // ==========================================
  // 28. PORSCHE (Macan, Cayenne, Taycan, Panamera)
  // ==========================================
  {
    brandRegex: /porsche/i,
    packageName: "Porsche Turbo / Turbo S / GTS",
    packageRegex: /\b(turbo|turbo\s*s|gts)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "hillHolder",
        "touchScreen", "bluetooth", "parkingSensors", "rearCamera", "camera360",
        "digitalClimate", "keylessGo", "foldingMirrors", "rainSensor", "ambientLighting",
        "ledMatrixHeadlights", "sunroof", "digitalCockpit", "carplayAndroidAuto",
        "leatherSeats", "electricSeats", "seatHeating", "electricTailgate", "laneAssist",
        "navigation", "premiumAudio"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 29. SUBARU (XV, Forester, Outback, Impreza)
  // ==========================================
  {
    brandRegex: /subaru/i,
    packageName: "Comfort / e-Boxer",
    packageRegex: /\b(comfort|e-boxer|elegance)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "digitalClimate", "carplayAndroidAuto", "laneAssist"
      ],
      excludedFeatures: ["seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /subaru/i,
    packageName: "Subaru Premium / X-Mode",
    packageRegex: /\b(premium|x-mode|xmode)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "digitalClimate", "carplayAndroidAuto", "laneAssist",
        "sunroof", "leatherSeats", "seatHeating", "ledMatrixHeadlights", "blindSpot"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 30. LEXUS (ES, RX, NX, UX, IS)
  // ==========================================
  {
    brandRegex: /lexus/i,
    packageName: "Comfort / Business",
    packageRegex: /\b(comfort|business)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "digitalClimate", "keylessGo", "ledMatrixHeadlights",
        "leatherSeats", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /lexus/i,
    packageName: "Executive / Exclusive / F Sport",
    packageRegex: /\b(executive|exclusive|f\s*sport)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "camera360", "digitalClimate", "keylessGo", "ledMatrixHeadlights",
        "leatherSeats", "electricSeats", "seatHeating", "seatCooling", "sunroof",
        "electricTailgate", "blindSpot", "premiumAudio", "carplayAndroidAuto"
      ],
    },
  },

  // ==========================================
  // 31. DS AUTOMOBILES (DS 4, DS 7, DS 9, DS 3)
  // ==========================================
  {
    brandRegex: /\bds\b|ds\s*automobiles/i,
    packageName: "Bastille / Performance Line",
    packageRegex: /\b(bastille|performance\s*line)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "digitalClimate", "digitalCockpit", "carplayAndroidAuto",
        "ledMatrixHeadlights"
      ],
      excludedFeatures: ["seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /\bds\b|ds\s*automobiles/i,
    packageName: "Rivoli / Opera",
    packageRegex: /\b(rivoli|opera)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo",
        "digitalCockpit", "carplayAndroidAuto", "ledMatrixHeadlights", "sunroof",
        "leatherSeats", "seatHeating", "ambientLighting", "blindSpot", "electricTailgate"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 32. MAZDA (Mazda 3, Mazda 6, CX-3, CX-5, CX-30)
  // ==========================================
  {
    brandRegex: /mazda/i,
    packageName: "Motion / Reflex",
    packageRegex: /\b(motion|reflex)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "digitalClimate", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360", "sunroof", "leatherSeats"],
    },
  },
  {
    brandRegex: /mazda/i,
    packageName: "Power / Power Sense",
    packageRegex: /\b(power|power\s*sense)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "carplayAndroidAuto",
        "sunroof", "leatherSeats", "seatHeating", "ledMatrixHeadlights", "blindSpot",
        "laneAssist", "premiumAudio"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 33. MITSUBISHI (Space Star, ASX, Eclipse Cross, L200)
  // ==========================================
  {
    brandRegex: /mitsubishi/i,
    packageName: "Invite",
    packageRegex: /\binvite\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /mitsubishi/i,
    packageName: "Intense / Instyle",
    packageRegex: /\b(intense|instyle)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 34. SSANGYONG / KGM (Korando, Tivoli, Rexton, Torres)
  // ==========================================
  {
    brandRegex: /ssangyong|kgm/i,
    packageName: "Limited / Platinum",
    packageRegex: /\b(limited|platinum)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "parkingSensors", "digitalClimate", "keylessGo", "digitalCockpit",
        "sunroof", "seatHeating", "leatherSeats", "laneAssist", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // 35. BYD (Atto 3, Seal, Dolphin, Tang, Han)
  // ==========================================
  {
    brandRegex: /\bbyd\b/i,
    packageName: "Design / Excellence",
    packageRegex: /\b(design|excellence)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "camera360", "rearCamera", "parkingSensors", "digitalClimate", "keylessGo",
        "digitalCockpit", "sunroof", "leatherSeats", "electricSeats", "seatHeating",
        "wirelessCharging", "electricTailgate", "laneAssist", "blindSpot",
        "emergencyBrake", "adaptiveCruise", "ledMatrixHeadlights", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 36. JAGUAR (XE, XF, F-Pace, E-Pace, I-Pace)
  // ==========================================
  {
    brandRegex: /jaguar/i,
    packageName: "Pure / Prestige",
    packageRegex: /\b(pure|prestige)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "leatherSeats",
        "ledMatrixHeadlights", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },
  {
    brandRegex: /jaguar/i,
    packageName: "R-Dynamic / HSE",
    packageRegex: /\b(r-dynamic|hse)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "leatherSeats",
        "electricSeats", "seatHeating", "digitalCockpit", "electricTailgate",
        "blindSpot", "premiumAudio", "ledMatrixHeadlights", "carplayAndroidAuto", "sunroof"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },

  // ==========================================
  // 37. MASERATI (Ghibli, Levante, Grecale, Quattroporte)
  // ==========================================
  {
    brandRegex: /maserati/i,
    packageName: "GT / Modena / Trofeo",
    packageRegex: /\b(gt|modena|trofeo)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "camera360", "digitalClimate", "keylessGo",
        "digitalCockpit", "foldingMirrors", "rainSensor", "ambientLighting",
        "ledMatrixHeadlights", "carplayAndroidAuto", "leatherSeats", "electricSeats",
        "seatHeating", "electricTailgate", "premiumAudio", "blindSpot"
      ],
      excludedFeatures: ["seatCooling"],
    },
  },
];

/**
 * Verilen araç için donanım paketi kurallarını tespit eder.
 */
export function matchTrimPackage(car: {
  brand?: string;
  model?: string;
  title?: string;
  description?: string;
  year?: number;
}): PackageEquipmentRules | null {
  const brand = (car.brand || "").trim();
  const model = (car.model || "").trim();
  const title = (car.title || "").trim();
  const description = (car.description || "").slice(0, 500);
  const hay = `${brand} ${model} ${title}`.toLocaleLowerCase("tr-TR");

  for (const entry of TRIM_PACKAGES_CATALOG) {
    if (entry.brandRegex.test(brand) || entry.brandRegex.test(hay)) {
      if (!entry.modelRegex || entry.modelRegex.test(model) || entry.modelRegex.test(hay)) {
        // 1. Başlık veya model alanında paket adı aranır
        if (entry.packageRegex.test(title) || entry.packageRegex.test(model)) {
          return entry.rules;
        }

        // 2. Açıklamanın ilk 500 karakterinde 'paket' doğrulaması (görünümlü/replika kontrolüyle)
        if (description) {
          const descMatch = entry.packageRegex.exec(description);
          if (descMatch) {
            const idx = descMatch.index;
            const surrounding = description.slice(Math.max(0, idx - 30), idx + descMatch[0].length + 30);
            const isLookalike = /(?:görünüm|gorunum|dönüşüm|donusum|body\s*kit|replika)/i.test(surrounding);
            if (!isLookalike) {
              return entry.rules;
            }
          }
        }
      }
    }
  }

  return null;
}
