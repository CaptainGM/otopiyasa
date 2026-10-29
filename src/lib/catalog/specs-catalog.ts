/**
 * Fabrika Teknik Verileri Kataloğu & Araç Dinamiği Tahmincisi
 *
 * Bu modül, Türkiye pazarındaki popüler marka ve modellerin fabrika çıkış
 * teknik verilerini (0-100 hızlanma, azami hız, maksimum tork, bagaj hacmi,
 * depo/batarya kapasitesi ve boş ağırlık) deterministik olarak çözer.
 * Katalogda tam eşleşmeyen nadir araçlar için fizik tabanlı gerçekçi
 * mühendislik yaklaşımları uygular.
 */

export interface TechnicalSpecs {
  /** 0-100 km/s Hızlanma (saniye) */
  acceleration?: number;
  /** Azami Hız (km/s) */
  topSpeed?: number;
  /** Maksimum Tork (Nm) */
  torque?: number;
  /** Bagaj Hacmi (Litre) */
  trunkCapacity?: number;
  /** Yakıt Deposu / Batarya Kapasitesi (örn: "50 L" veya "108.4 kWh") */
  fuelTank?: string;
  /** Boş Ağırlık (kg) */
  curbWeight?: number;
  /** Veri kaynağı: "catalog" (fabrika broşürü) | "derived" (araç dinamiği tahmini) | "listing" */
  specSource: "catalog" | "derived" | "listing";
}

interface CatalogEntry {
  brandRegex: RegExp;
  modelRegex: RegExp;
  yearRange?: [number, number];
  fuelRegex?: RegExp;
  specs: {
    acceleration: number;
    topSpeed: number;
    torque: number;
    trunkCapacity: number;
    fuelTank: string;
    curbWeight?: number;
  };
}

/**
 * Türkiye pazarındaki en yaygın marka ve modellerin fabrika broşür veritabanı.
 */
const CATALOG_DATABASE: CatalogEntry[] = [
  // --- PORSCHE ---
  {
    brandRegex: /porsche/i,
    modelRegex: /macan.*turbo.*elek|macan.*electric/i,
    specs: { acceleration: 3.3, topSpeed: 260, torque: 1130, trunkCapacity: 540, fuelTank: "100 kWh", curbWeight: 2405 },
  },
  {
    brandRegex: /porsche/i,
    modelRegex: /macan.*4.*elek/i,
    specs: { acceleration: 5.2, topSpeed: 220, torque: 650, trunkCapacity: 540, fuelTank: "100 kWh", curbWeight: 2330 },
  },
  {
    brandRegex: /porsche/i,
    modelRegex: /macan.*gts/i,
    specs: { acceleration: 4.3, topSpeed: 272, torque: 550, trunkCapacity: 488, fuelTank: "65 L", curbWeight: 1960 },
  },
  {
    brandRegex: /porsche/i,
    modelRegex: /macan/i,
    specs: { acceleration: 6.4, topSpeed: 232, torque: 400, trunkCapacity: 488, fuelTank: "65 L", curbWeight: 1845 },
  },
  {
    brandRegex: /porsche/i,
    modelRegex: /taycan.*turbo/i,
    specs: { acceleration: 2.8, topSpeed: 260, torque: 1050, trunkCapacity: 407, fuelTank: "93.4 kWh", curbWeight: 2370 },
  },
  {
    brandRegex: /porsche/i,
    modelRegex: /taycan/i,
    specs: { acceleration: 5.4, topSpeed: 230, torque: 345, trunkCapacity: 407, fuelTank: "79.2 kWh", curbWeight: 2050 },
  },
  {
    brandRegex: /porsche/i,
    modelRegex: /cayenne/i,
    specs: { acceleration: 5.9, topSpeed: 245, torque: 450, trunkCapacity: 770, fuelTank: "75 L", curbWeight: 2055 },
  },
  {
    brandRegex: /porsche/i,
    modelRegex: /panamera/i,
    specs: { acceleration: 5.3, topSpeed: 270, torque: 450, trunkCapacity: 495, fuelTank: "75 L", curbWeight: 1940 },
  },

  // --- MERCEDES-BENZ ---
  {
    brandRegex: /mercedes/i,
    modelRegex: /eqs.*580/i,
    specs: { acceleration: 4.3, topSpeed: 210, torque: 858, trunkCapacity: 610, fuelTank: "108.4 kWh", curbWeight: 2585 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /eqs.*53.*amg/i,
    specs: { acceleration: 3.8, topSpeed: 220, torque: 950, trunkCapacity: 610, fuelTank: "108.4 kWh", curbWeight: 2655 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /eqs.*450/i,
    specs: { acceleration: 6.2, topSpeed: 210, torque: 568, trunkCapacity: 610, fuelTank: "108.4 kWh", curbWeight: 2480 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /eqe.*350/i,
    specs: { acceleration: 6.4, topSpeed: 210, torque: 530, trunkCapacity: 430, fuelTank: "89 kWh", curbWeight: 2355 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /c.*200.*4matic|c.*200/i,
    yearRange: [2021, 2030],
    specs: { acceleration: 7.1, topSpeed: 241, torque: 300, trunkCapacity: 455, fuelTank: "66 L", curbWeight: 1650 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /c.*180/i,
    yearRange: [2014, 2021],
    specs: { acceleration: 8.2, topSpeed: 225, torque: 250, trunkCapacity: 480, fuelTank: "66 L", curbWeight: 1425 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /e.*200/i,
    specs: { acceleration: 7.5, topSpeed: 240, torque: 320, trunkCapacity: 540, fuelTank: "66 L", curbWeight: 1700 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /e.*220.*d/i,
    specs: { acceleration: 7.3, topSpeed: 240, torque: 400, trunkCapacity: 540, fuelTank: "66 L", curbWeight: 1780 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /a.*180/i,
    specs: { acceleration: 8.8, topSpeed: 215, torque: 230, trunkCapacity: 370, fuelTank: "43 L", curbWeight: 1365 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /cla.*200/i,
    specs: { acceleration: 8.2, topSpeed: 229, torque: 250, trunkCapacity: 460, fuelTank: "43 L", curbWeight: 1430 },
  },
  {
    brandRegex: /mercedes/i,
    modelRegex: /glc/i,
    specs: { acceleration: 7.8, topSpeed: 221, torque: 320, trunkCapacity: 620, fuelTank: "62 L", curbWeight: 1925 },
  },

  // --- FORD ---
  {
    brandRegex: /ford/i,
    modelRegex: /tourneo.*connect/i,
    yearRange: [2002, 2013],
    specs: { acceleration: 13.5, topSpeed: 164, torque: 250, trunkCapacity: 1200, fuelTank: "60 L", curbWeight: 1495 },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /tourneo.*connect/i,
    yearRange: [2014, 2030],
    specs: { acceleration: 11.2, topSpeed: 175, torque: 270, trunkCapacity: 1029, fuelTank: "60 L", curbWeight: 1540 },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /tourneo.*courier/i,
    specs: { acceleration: 13.4, topSpeed: 170, torque: 215, trunkCapacity: 708, fuelTank: "47 L", curbWeight: 1280 },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /focus.*1\.5.*tdci|focus.*diesel/i,
    specs: { acceleration: 10.5, topSpeed: 195, torque: 300, trunkCapacity: 511, fuelTank: "53 L", curbWeight: 1363 },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /focus.*1\.0|focus.*ecoboost/i,
    specs: { acceleration: 10.0, topSpeed: 200, torque: 170, trunkCapacity: 511, fuelTank: "52 L", curbWeight: 1322 },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /focus/i,
    specs: { acceleration: 10.2, topSpeed: 196, torque: 240, trunkCapacity: 511, fuelTank: "52 L", curbWeight: 1340 },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /fiesta/i,
    specs: { acceleration: 10.5, topSpeed: 180, torque: 170, trunkCapacity: 292, fuelTank: "42 L", curbWeight: 1144 },
  },
  {
    brandRegex: /ford/i,
    modelRegex: /kuga/i,
    specs: { acceleration: 9.7, topSpeed: 195, torque: 240, trunkCapacity: 511, fuelTank: "54 L", curbWeight: 1564 },
  },

  // --- VOLKSWAGEN ---
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /golf.*1\.5.*tsi|golf.*1\.5/i,
    specs: { acceleration: 8.5, topSpeed: 224, torque: 250, trunkCapacity: 381, fuelTank: "50 L", curbWeight: 1340 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /golf.*1\.0.*tsi/i,
    specs: { acceleration: 10.2, topSpeed: 202, torque: 200, trunkCapacity: 381, fuelTank: "50 L", curbWeight: 1255 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /golf.*1\.6.*tdi/i,
    specs: { acceleration: 10.2, topSpeed: 198, torque: 250, trunkCapacity: 380, fuelTank: "50 L", curbWeight: 1300 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /golf/i,
    specs: { acceleration: 9.2, topSpeed: 210, torque: 250, trunkCapacity: 381, fuelTank: "50 L", curbWeight: 1300 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /passat.*1\.5.*tsi/i,
    specs: { acceleration: 8.7, topSpeed: 220, torque: 250, trunkCapacity: 586, fuelTank: "66 L", curbWeight: 1445 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /passat.*1\.6.*tdi/i,
    specs: { acceleration: 10.8, topSpeed: 206, torque: 250, trunkCapacity: 586, fuelTank: "66 L", curbWeight: 1470 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /passat.*2\.0.*tdi/i,
    specs: { acceleration: 8.7, topSpeed: 220, torque: 340, trunkCapacity: 586, fuelTank: "66 L", curbWeight: 1530 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /passat/i,
    specs: { acceleration: 8.9, topSpeed: 218, torque: 250, trunkCapacity: 586, fuelTank: "66 L", curbWeight: 1460 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /polo.*1\.0.*tsi/i,
    specs: { acceleration: 10.8, topSpeed: 187, torque: 175, trunkCapacity: 351, fuelTank: "40 L", curbWeight: 1145 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /polo/i,
    specs: { acceleration: 11.2, topSpeed: 185, torque: 175, trunkCapacity: 351, fuelTank: "40 L", curbWeight: 1150 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /tiguan.*1\.5/i,
    specs: { acceleration: 9.2, topSpeed: 202, torque: 250, trunkCapacity: 615, fuelTank: "58 L", curbWeight: 1510 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /tiguan/i,
    specs: { acceleration: 9.3, topSpeed: 200, torque: 250, trunkCapacity: 615, fuelTank: "58 L", curbWeight: 1530 },
  },
  {
    brandRegex: /volkswagen|vw/i,
    modelRegex: /caddy/i,
    specs: { acceleration: 11.4, topSpeed: 186, torque: 280, trunkCapacity: 1213, fuelTank: "50 L", curbWeight: 1550 },
  },

  // --- RENAULT ---
  {
    brandRegex: /renault/i,
    modelRegex: /clio.*1\.0.*tce/i,
    specs: { acceleration: 11.5, topSpeed: 187, torque: 160, trunkCapacity: 391, fuelTank: "42 L", curbWeight: 1150 },
  },
  {
    brandRegex: /renault/i,
    modelRegex: /clio.*1\.5.*dci/i,
    specs: { acceleration: 11.9, topSpeed: 180, torque: 220, trunkCapacity: 300, fuelTank: "45 L", curbWeight: 1165 },
  },
  {
    brandRegex: /renault/i,
    modelRegex: /clio/i,
    specs: { acceleration: 12.0, topSpeed: 180, torque: 160, trunkCapacity: 391, fuelTank: "42 L", curbWeight: 1150 },
  },
  {
    brandRegex: /renault/i,
    modelRegex: /megane.*1\.3.*tce/i,
    specs: { acceleration: 9.5, topSpeed: 205, torque: 240, trunkCapacity: 503, fuelTank: "50 L", curbWeight: 1320 },
  },
  {
    brandRegex: /renault/i,
    modelRegex: /megane.*1\.5.*dci/i,
    specs: { acceleration: 11.2, topSpeed: 190, torque: 260, trunkCapacity: 503, fuelTank: "49 L", curbWeight: 1350 },
  },
  {
    brandRegex: /renault/i,
    modelRegex: /megane/i,
    specs: { acceleration: 10.2, topSpeed: 198, torque: 240, trunkCapacity: 503, fuelTank: "50 L", curbWeight: 1330 },
  },
  {
    brandRegex: /renault/i,
    modelRegex: /symbol/i,
    specs: { acceleration: 12.5, topSpeed: 168, torque: 200, trunkCapacity: 510, fuelTank: "50 L", curbWeight: 1060 },
  },
  {
    brandRegex: /renault/i,
    modelRegex: /austral/i,
    specs: { acceleration: 8.4, topSpeed: 175, torque: 250, trunkCapacity: 500, fuelTank: "55 L", curbWeight: 1530 },
  },

  // --- FIAT ---
  {
    brandRegex: /fiat/i,
    modelRegex: /egea.*1\.3.*multijet/i,
    specs: { acceleration: 12.0, topSpeed: 181, torque: 200, trunkCapacity: 520, fuelTank: "45 L", curbWeight: 1205 },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /egea.*1\.6.*multijet/i,
    specs: { acceleration: 9.8, topSpeed: 200, torque: 320, trunkCapacity: 520, fuelTank: "45 L", curbWeight: 1270 },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /egea.*1\.4.*fire/i,
    specs: { acceleration: 11.5, topSpeed: 185, torque: 127, trunkCapacity: 520, fuelTank: "45 L", curbWeight: 1150 },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /egea/i,
    specs: { acceleration: 11.5, topSpeed: 185, torque: 200, trunkCapacity: 520, fuelTank: "45 L", curbWeight: 1200 },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /fiorino/i,
    specs: { acceleration: 13.9, topSpeed: 161, torque: 200, trunkCapacity: 330, fuelTank: "45 L", curbWeight: 1205 },
  },
  {
    brandRegex: /fiat/i,
    modelRegex: /doblo/i,
    specs: { acceleration: 13.4, topSpeed: 164, torque: 290, trunkCapacity: 790, fuelTank: "60 L", curbWeight: 1430 },
  },

  // --- TOYOTA ---
  {
    brandRegex: /toyota/i,
    modelRegex: /corolla.*hybrid/i,
    specs: { acceleration: 9.3, topSpeed: 180, torque: 142, trunkCapacity: 471, fuelTank: "43 L", curbWeight: 1360 },
  },
  {
    brandRegex: /toyota/i,
    modelRegex: /corolla.*1\.6/i,
    specs: { acceleration: 9.7, topSpeed: 200, torque: 159, trunkCapacity: 471, fuelTank: "50 L", curbWeight: 1275 },
  },
  {
    brandRegex: /toyota/i,
    modelRegex: /corolla.*1\.4.*d-4d|corolla.*diesel/i,
    specs: { acceleration: 12.5, topSpeed: 180, torque: 205, trunkCapacity: 452, fuelTank: "55 L", curbWeight: 1280 },
  },
  {
    brandRegex: /toyota/i,
    modelRegex: /corolla/i,
    specs: { acceleration: 10.0, topSpeed: 190, torque: 153, trunkCapacity: 471, fuelTank: "48 L", curbWeight: 1320 },
  },
  {
    brandRegex: /toyota/i,
    modelRegex: /c-hr/i,
    specs: { acceleration: 9.9, topSpeed: 170, torque: 142, trunkCapacity: 388, fuelTank: "43 L", curbWeight: 1420 },
  },
  {
    brandRegex: /toyota/i,
    modelRegex: /yaris/i,
    specs: { acceleration: 10.2, topSpeed: 175, torque: 141, trunkCapacity: 286, fuelTank: "36 L", curbWeight: 1090 },
  },

  // --- BMW ---
  {
    brandRegex: /bmw/i,
    modelRegex: /320i|320d|3.*serisi/i,
    specs: { acceleration: 7.1, topSpeed: 235, torque: 300, trunkCapacity: 480, fuelTank: "59 L", curbWeight: 1565 },
  },
  {
    brandRegex: /bmw/i,
    modelRegex: /520i|520d|5.*serisi/i,
    specs: { acceleration: 7.9, topSpeed: 235, torque: 350, trunkCapacity: 530, fuelTank: "68 L", curbWeight: 1680 },
  },
  {
    brandRegex: /bmw/i,
    modelRegex: /116d|118i|1.*serisi/i,
    specs: { acceleration: 8.5, topSpeed: 213, torque: 220, trunkCapacity: 380, fuelTank: "42 L", curbWeight: 1365 },
  },
  {
    brandRegex: /bmw/i,
    modelRegex: /i4/i,
    specs: { acceleration: 5.7, topSpeed: 190, torque: 430, trunkCapacity: 470, fuelTank: "83.9 kWh", curbWeight: 2125 },
  },
  {
    brandRegex: /bmw/i,
    modelRegex: /x1/i,
    specs: { acceleration: 8.9, topSpeed: 208, torque: 230, trunkCapacity: 540, fuelTank: "45 L", curbWeight: 1575 },
  },
  {
    brandRegex: /bmw/i,
    modelRegex: /x3/i,
    specs: { acceleration: 8.3, topSpeed: 215, torque: 290, trunkCapacity: 550, fuelTank: "65 L", curbWeight: 1800 },
  },

  // --- AUDI ---
  {
    brandRegex: /audi/i,
    modelRegex: /a3/i,
    specs: { acceleration: 8.4, topSpeed: 224, torque: 250, trunkCapacity: 380, fuelTank: "50 L", curbWeight: 1355 },
  },
  {
    brandRegex: /audi/i,
    modelRegex: /a4/i,
    specs: { acceleration: 7.4, topSpeed: 241, torque: 320, trunkCapacity: 460, fuelTank: "54 L", curbWeight: 1545 },
  },
  {
    brandRegex: /audi/i,
    modelRegex: /a6/i,
    specs: { acceleration: 7.0, topSpeed: 250, torque: 400, trunkCapacity: 530, fuelTank: "63 L", curbWeight: 1750 },
  },

  // --- HONDA ---
  {
    brandRegex: /honda/i,
    modelRegex: /civic.*1\.5.*vtec/i,
    specs: { acceleration: 8.1, topSpeed: 220, torque: 240, trunkCapacity: 519, fuelTank: "47 L", curbWeight: 1350 },
  },
  {
    brandRegex: /honda/i,
    modelRegex: /civic.*1\.6/i,
    specs: { acceleration: 10.6, topSpeed: 200, torque: 152, trunkCapacity: 519, fuelTank: "47 L", curbWeight: 1260 },
  },
  {
    brandRegex: /honda/i,
    modelRegex: /civic/i,
    specs: { acceleration: 8.9, topSpeed: 210, torque: 220, trunkCapacity: 519, fuelTank: "47 L", curbWeight: 1300 },
  },

  // --- HYUNDAI ---
  {
    brandRegex: /hyundai/i,
    modelRegex: /i20/i,
    specs: { acceleration: 11.4, topSpeed: 185, torque: 172, trunkCapacity: 352, fuelTank: "40 L", curbWeight: 1120 },
  },
  {
    brandRegex: /hyundai/i,
    modelRegex: /tucson/i,
    specs: { acceleration: 8.9, topSpeed: 201, torque: 265, trunkCapacity: 620, fuelTank: "54 L", curbWeight: 1550 },
  },

  // --- PEUGEOT ---
  {
    brandRegex: /peugeot/i,
    modelRegex: /208/i,
    specs: { acceleration: 9.9, topSpeed: 188, torque: 205, trunkCapacity: 311, fuelTank: "44 L", curbWeight: 1165 },
  },
  {
    brandRegex: /peugeot/i,
    modelRegex: /3008/i,
    specs: { acceleration: 9.7, topSpeed: 196, torque: 230, trunkCapacity: 520, fuelTank: "53 L", curbWeight: 1400 },
  },

  // --- TESLA ---
  {
    brandRegex: /tesla/i,
    modelRegex: /model.*y.*performance/i,
    specs: { acceleration: 3.7, topSpeed: 250, torque: 660, trunkCapacity: 854, fuelTank: "78.1 kWh", curbWeight: 1995 },
  },
  {
    brandRegex: /tesla/i,
    modelRegex: /model.*y/i,
    specs: { acceleration: 5.0, topSpeed: 217, torque: 493, trunkCapacity: 854, fuelTank: "75 kWh", curbWeight: 1909 },
  },
  {
    brandRegex: /tesla/i,
    modelRegex: /model.*3/i,
    specs: { acceleration: 4.4, topSpeed: 233, torque: 493, trunkCapacity: 594, fuelTank: "75 kWh", curbWeight: 1828 },
  },

  // --- TOGG ---
  {
    brandRegex: /togg/i,
    modelRegex: /t10x.*v2|t10x/i,
    specs: { acceleration: 7.8, topSpeed: 185, torque: 350, trunkCapacity: 441, fuelTank: "88.5 kWh", curbWeight: 2126 },
  },

  // --- CHERY ---
  {
    brandRegex: /chery/i,
    modelRegex: /omoda.*5/i,
    specs: { acceleration: 8.6, topSpeed: 195, torque: 290, trunkCapacity: 378, fuelTank: "51 L", curbWeight: 1444 },
  },
  {
    brandRegex: /chery/i,
    modelRegex: /tiggo.*7.*pro/i,
    specs: { acceleration: 9.2, topSpeed: 190, torque: 290, trunkCapacity: 475, fuelTank: "51 L", curbWeight: 1497 },
  },
  {
    brandRegex: /chery/i,
    modelRegex: /tiggo.*8.*pro/i,
    specs: { acceleration: 8.9, topSpeed: 190, torque: 290, trunkCapacity: 889, fuelTank: "57 L", curbWeight: 1587 },
  },

  // --- DACIA ---
  {
    brandRegex: /dacia/i,
    modelRegex: /duster/i,
    specs: { acceleration: 10.6, topSpeed: 175, torque: 250, trunkCapacity: 478, fuelTank: "50 L", curbWeight: 1300 },
  },
  {
    brandRegex: /dacia/i,
    modelRegex: /sandero/i,
    specs: { acceleration: 11.7, topSpeed: 178, torque: 160, trunkCapacity: 328, fuelTank: "50 L", curbWeight: 1080 },
  },
];

/**
 * Fizik ve segment temelli gerçekçi tahmin fonksiyonu (Katalogda doğrudan bulunamayan araçlar için).
 */
export function estimateSpecsFromDynamics(car: {
  brand?: string;
  model?: string;
  year?: number;
  vehicleClass?: string;
  horsepower?: number;
  engineSize?: number;
  fuelType?: string;
  bodyType?: string;
}): TechnicalSpecs {
  const hp = car.horsepower && car.horsepower > 0 ? car.horsepower : 120;
  const isElectric = (car.fuelType || "").toLowerCase().includes("elektrik");
  const isDiesel = (car.fuelType || "").toLowerCase().includes("dizel");
  const body = (car.bodyType || car.vehicleClass || "").toLowerCase();

  // Ağırlık tahmini (kg)
  let weight = 1350;
  if (isElectric) weight = hp > 300 ? 2300 : 1900;
  else if (body.includes("suv") || body.includes("arazi")) weight = 1600;
  else if (body.includes("minivan") || body.includes("panelvan") || body.includes("kombi")) weight = 1500;
  else if (body.includes("sedan") || body.includes("station")) weight = 1420;
  else if (body.includes("hatchback")) weight = 1200;

  // 0-100 Hızlanma (sn) - Güç / Ağırlık Oranı
  let acc: number;
  if (isElectric) {
    acc = Math.max(2.8, Math.min(10.5, Number((1800 / (hp * 1.5 + 100)).toFixed(1))));
  } else {
    // İçten yanmalı tahmini
    const ratio = weight / hp;
    acc = Math.max(3.5, Math.min(16.5, Number((ratio * 0.95).toFixed(1))));
  }

  // Azami Hız (km/s)
  let speed: number;
  if (isElectric) {
    speed = hp > 400 ? 250 : hp > 250 ? 210 : 180;
  } else {
    speed = Math.min(270, Math.max(150, Math.round(135 + Math.sqrt(hp) * 6.5)));
  }

  // Tork (Nm)
  let torque: number;
  if (isElectric) {
    torque = Math.round(hp * 1.6);
  } else if (isDiesel) {
    torque = Math.round(hp * 2.3);
  } else {
    torque = Math.round(hp * 1.5);
  }

  // Bagaj Hacmi (L)
  let trunk = 450;
  if (body.includes("minivan") || body.includes("panelvan") || body.includes("kombi")) trunk = 1100;
  else if (body.includes("suv")) trunk = 520;
  else if (body.includes("sedan")) trunk = 500;
  else if (body.includes("hatchback")) trunk = 350;

  // Depo / Batarya
  const tank = isElectric ? (hp > 300 ? "90 kWh" : "60 kWh") : (trunk > 800 ? "60 L" : "50 L");

  return {
    acceleration: acc,
    topSpeed: speed,
    torque,
    trunkCapacity: trunk,
    fuelTank: tank,
    curbWeight: weight,
    specSource: "derived",
  };
}

/**
 * Bir araç için fabrika teknik verilerini çözer.
 * Varsa ilanın kendi teknik alanlarını korur, eksikleri katalogdan veya dinamik tahminciden tamamlar.
 */
export function resolveTechnicalSpecs(car: {
  brand?: string;
  model?: string;
  year?: number;
  vehicleClass?: string;
  title?: string;
  features?: {
    horsepower?: number;
    engineSize?: number;
    fuelType?: string;
    bodyType?: string;
    acceleration?: number;
    topSpeed?: number;
    torque?: number;
    fuelTank?: string;
  };
}): TechnicalSpecs {
  const brand = (car.brand || "").trim();
  const model = (car.model || "").trim();
  const title = (car.title || "").trim();
  const year = car.year || new Date().getFullYear();
  const hay = `${brand} ${model} ${title}`.toLowerCase();
  const feat = car.features || {};

  // 1. Doğrudan ilanda tanımlı fabrika alanları var mı?
  if (feat.acceleration && feat.topSpeed && feat.torque) {
    return {
      acceleration: feat.acceleration,
      topSpeed: feat.topSpeed,
      torque: feat.torque,
      trunkCapacity: 450,
      fuelTank: feat.fuelTank || "50 L",
      specSource: "listing",
    };
  }

  // 2. Fabrika broşür kataloğunda eşleştir
  for (const entry of CATALOG_DATABASE) {
    if (entry.brandRegex.test(brand) || entry.brandRegex.test(hay)) {
      if (entry.modelRegex.test(model) || entry.modelRegex.test(hay)) {
        if (!entry.yearRange || (year >= entry.yearRange[0] && year <= entry.yearRange[1])) {
          return {
            acceleration: feat.acceleration || entry.specs.acceleration,
            topSpeed: feat.topSpeed || entry.specs.topSpeed,
            torque: feat.torque || entry.specs.torque,
            trunkCapacity: entry.specs.trunkCapacity,
            fuelTank: feat.fuelTank || entry.specs.fuelTank,
            curbWeight: entry.specs.curbWeight,
            specSource: "catalog",
          };
        }
      }
    }
  }

  // 3. Eşleşme yoksa fizik/dinamik modelinden türet
  const derived = estimateSpecsFromDynamics({
    brand,
    model,
    year,
    vehicleClass: car.vehicleClass,
    horsepower: feat.horsepower,
    engineSize: feat.engineSize,
    fuelType: feat.fuelType,
    bodyType: feat.bodyType,
  });

  return {
    acceleration: feat.acceleration || derived.acceleration,
    topSpeed: feat.topSpeed || derived.topSpeed,
    torque: feat.torque || derived.torque,
    trunkCapacity: derived.trunkCapacity,
    fuelTank: feat.fuelTank || derived.fuelTank,
    curbWeight: derived.curbWeight,
    specSource: "derived",
  };
}

