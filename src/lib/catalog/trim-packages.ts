/**
 * Türkiye Otomobil Pazarı Donanım Paketleri & Fabrika Broşür Matrisi
 *
 * Her markanın resmi satış broşürlerindeki donanım paketlerini (Trim levels)
 * ve paketlerin standart sunduğu donanımları içerir.
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
  // VOLKSWAGEN (Polo, Golf, Passat, Tiguan, T-Roc)
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
    packageName: "Highline / Elegance / R-Line / Style",
    packageRegex: /\b(highline|elegance|r-line|rline|style)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "parkingSensors", "rearCamera",
        "rainSensor", "digitalClimate", "touchScreen", "bluetooth", "ambientLighting",
        "foldingMirrors", "keylessGo", "ledMatrixHeadlights", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // RENAULT (Clio, Megane, Symbol, Austral, Captur)
  // ==========================================
  {
    brandRegex: /renault/i,
    packageName: "Joy / Authentique / Equilibre",
    packageRegex: /\b(joy|joy\s*plus|authentique|equilibre)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "wirelessCharging", "digitalClimate", "rearCamera"],
    },
  },
  {
    brandRegex: /renault/i,
    packageName: "Touch / Evolution",
    packageRegex: /\b(touch|touch\s*plus|evolution)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth", "rainSensor", "parkingSensors"],
      excludedFeatures: ["seatCooling", "camera360", "leatherSeats"],
    },
  },
  {
    brandRegex: /renault/i,
    packageName: "Icon / Intens / Techno / RS Line",
    packageRegex: /\b(icon|intens|techno|rs\s*line|esprit\s*alpine)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rainSensor", "parkingSensors", "rearCamera", "digitalClimate", "keylessGo",
        "ledMatrixHeadlights", "foldingMirrors", "ambientLighting", "carplayAndroidAuto"
      ],
      excludedFeatures: ["seatCooling", "camera360"],
    },
  },

  // ==========================================
  // FIAT (Egea Sedan / HB / Cross)
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
    packageName: "Lounge / Limited",
    packageRegex: /\b(lounge|lounge\s*plus|limited)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "bluetooth", "touchScreen",
        "carplayAndroidAuto", "digitalClimate", "parkingSensors", "rearCamera",
        "rainSensor", "digitalCockpit", "keylessGo"
      ],
      excludedFeatures: ["seatCooling", "camera360", "electricTailgate"],
    },
  },

  // ==========================================
  // TOYOTA (Corolla, Yaris, C-HR)
  // ==========================================
  {
    brandRegex: /toyota/i,
    packageName: "Vision",
    packageRegex: /\bvision\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "tirePressure", "bluetooth"],
      excludedFeatures: ["sunroof", "seatHeating", "seatCooling", "digitalCockpit", "camera360", "wirelessCharging", "rearCamera"],
    },
  },
  {
    brandRegex: /toyota/i,
    packageName: "Dream",
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
    packageName: "Passion / Passion X-Pack",
    packageRegex: /\bpassion\b/i,
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
  // HONDA (Civic)
  // ==========================================
  {
    brandRegex: /honda/i,
    modelRegex: /civic/i,
    packageName: "Elegance",
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
    packageName: "Executive / Executive Plus",
    packageRegex: /\bexecutive\b/i,
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
  // PEUGEOT (208, 308, 2008, 3008, 5008)
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
    packageName: "Allure",
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
  // FORD (Focus, Fiesta, Kuga, Tourneo Connect)
  // ==========================================
  {
    brandRegex: /ford/i,
    modelRegex: /tourneo.*connect/i,
    packageName: "Tourneo Connect GLX / Titanium",
    packageRegex: /\b(glx|titanium|deluxe)\b/i,
    rules: {
      standardFeatures: ["absEsp", "airbags", "isofix", "rainSensor"],
      excludedFeatures: ["camera360", "seatCooling", "digitalCockpit", "carplayAndroidAuto", "electricTailgate", "wirelessCharging", "ledMatrixHeadlights", "adaptiveCruise"],
    },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /focus|fiesta|kuga/i,
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
    modelRegex: /focus|kuga/i,
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

  // ==========================================
  // HYUNDAI (i20, Tucson, Elantra)
  // ==========================================
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
    modelRegex: /tucson/i,
    packageName: "Elite / Elite Plus",
    packageRegex: /\belite\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "rearCamera", "parkingSensors", "carplayAndroidAuto", "digitalClimate",
        "keylessGo", "digitalCockpit", "sunroof", "leatherSeats", "seatHeating",
        "foldingMirrors", "rainSensor", "ambientLighting", "blindSpot", "laneAssist"
      ],
      excludedFeatures: ["seatCooling"], // Soğutma yalnızca N-Line / özel pakette
    },
  },

  // ==========================================
  // CHERY (Omoda 5, Tiggo 7 Pro, Tiggo 8 Pro)
  // ==========================================
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
  // SKODA (Octavia, Superb, Kodiaq)
  // ==========================================
  {
    brandRegex: /skoda/i,
    packageName: "Style / Premium",
    packageRegex: /\b(style|premium)\b/i,
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
  // BMW (Sport Line, M Sport, Luxury Line)
  // ==========================================
  {
    brandRegex: /bmw/i,
    packageName: "BMW Sport Line",
    packageRegex: /\b(sport\s*line|sportline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "laneAssist", "emergencyBrake"
      ],
      excludedFeatures: ["seatCooling", "camera360", "heatedSteering", "electricTailgate"],
    },
  },
  {
    brandRegex: /bmw/i,
    packageName: "M Sport / M Sport Pro",
    packageRegex: /\b(m\s*sport|msport|m\s*paket)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "sunroof", "digitalCockpit",
        "carplayAndroidAuto", "laneAssist", "emergencyBrake"
      ],
      excludedFeatures: ["seatCooling", "camera360", "heatedSteering"],
    },
  },

  // ==========================================
  // AUDI (Advanced, S line)
  // ==========================================
  {
    brandRegex: /audi/i,
    packageName: "Audi Advanced",
    packageRegex: /\b(advanced|design)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "digitalClimate", "keylessGo", "foldingMirrors", "rainSensor",
        "ledMatrixHeadlights", "digitalCockpit", "carplayAndroidAuto", "laneAssist", "emergencyBrake"
      ],
      excludedFeatures: ["seatCooling", "heatedSteering"],
    },
  },
  {
    brandRegex: /audi/i,
    packageName: "Audi S line",
    packageRegex: /\b(s\s*line|s-line|sline)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "laneAssist", "emergencyBrake", "sunroof"
      ],
      excludedFeatures: ["seatCooling", "heatedSteering"],
    },
  },

  // ==========================================
  // MERCEDES-BENZ (AMG Line, Exclusive, Progressive, Heritage)
  // ==========================================
  {
    brandRegex: /mercedes/i,
    packageName: "AMG / AMG Line",
    packageRegex: /\b(amg|amg\s*line|amg\s*sport)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "sunroof", "digitalCockpit",
        "carplayAndroidAuto", "laneAssist", "emergencyBrake", "leatherSeats"
      ],
    },
  },
  {
    brandRegex: /mercedes/i,
    packageName: "Exclusive / Progressive",
    packageRegex: /\b(exclusive|progressive)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "parkingSensors", "rearCamera", "digitalClimate", "keylessGo", "foldingMirrors",
        "rainSensor", "ambientLighting", "ledMatrixHeadlights", "digitalCockpit",
        "carplayAndroidAuto", "laneAssist", "emergencyBrake", "leatherSeats"
      ],
    },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /eqs/i,
    packageName: "EQS Heritage Edition / AMG",
    packageRegex: /\b(heritage|amg|edition\s*1)\b/i,
    rules: {
      standardFeatures: [
        "absEsp", "airbags", "isofix", "tirePressure", "touchScreen", "bluetooth",
        "camera360", "rearCamera", "parkingSensors", "sunroof", "digitalCockpit",
        "digitalClimate", "keylessGo", "wirelessCharging", "electricTailgate",
        "leatherSeats", "ledMatrixHeadlights", "foldingMirrors", "rainSensor",
        "seatHeating", "seatCooling", "adaptiveCruise", "laneAssist", "blindSpot",
        "emergencyBrake", "premiumAudio", "electricSeats", "heatedSteering",
        "ambientLighting", "carplayAndroidAuto"
      ],
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
  year?: number;
}): PackageEquipmentRules | null {
  const brand = (car.brand || "").trim();
  const model = (car.model || "").trim();
  const title = (car.title || "").trim();
  const hay = `${brand} ${model} ${title}`.toLowerCase();

  for (const entry of TRIM_PACKAGES_CATALOG) {
    if (entry.brandRegex.test(brand) || entry.brandRegex.test(hay)) {
      if (!entry.modelRegex || entry.modelRegex.test(model) || entry.modelRegex.test(hay)) {
        if (entry.packageRegex.test(title) || entry.packageRegex.test(model)) {
          return entry.rules;
        }
      }
    }
  }

  return null;
}

