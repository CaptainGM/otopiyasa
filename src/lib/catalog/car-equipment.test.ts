import { describe, it, expect } from "vitest";
import { evaluateCarEquipment } from "./car-equipment";

describe("car-equipment comprehensive test suite (100+ tests)", () => {
  // Helper to extract a feature present status
  function hasFeature(car: Parameters<typeof evaluateCarEquipment>[0], categoryId: string, featureId: string): boolean {
    const categories = evaluateCarEquipment(car);
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return false;
    const item = cat.items.find((i) => i.id === featureId);
    return item ? item.present : false;
  }

  // ==========================================
  // 1. VOLKSWAGEN (Polo, Golf, Passat, Tiguan, T-Roc, Taigo, Arteon)
  // ==========================================
  it("VW Polo Trendline (base) has ABS/ESP but lacks modern luxuries", () => {
    const car = { brand: "Volkswagen", model: "Polo", year: 2017, title: "VW Polo 1.0 Trendline 2017" };
    expect(hasFeature(car, "safety", "absEsp")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(false);
    expect(hasFeature(car, "exterior", "camera360")).toBe(false);
  });

  it("VW Golf Impression (base) has basic features but lacks carplay and climate", () => {
    const car = { brand: "Volkswagen", model: "Golf", year: 2021, title: "Golf 1.0 eTSI Impression 2021" };
    expect(hasFeature(car, "safety", "absEsp")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(false);
  });

  it("VW Golf Life (mid) has touchscreen, bluetooth, rain sensor and digital climate", () => {
    const car = { brand: "Volkswagen", model: "Golf", year: 2022, title: "Golf 1.0 eTSI Life 2022" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
    expect(hasFeature(car, "exterior", "rainSensor")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(false);
  });

  it("VW Golf Style (high) has digital cockpit, LED headlights, ambient lighting, keyless go", () => {
    const car = { brand: "Volkswagen", model: "Golf", year: 2022, title: "Golf 1.5 eTSI Style 2022" };
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
  });

  it("VW Golf R-Line has panoramic sunroof, digital cockpit, LED matrix and sport styling", () => {
    const car = { brand: "Volkswagen", model: "Golf", year: 2023, title: "Golf 1.5 eTSI R-Line 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(false);
  });

  it("VW Passat Business has parking sensors, climatronic, rain sensor, carplay", () => {
    const car = { brand: "Volkswagen", model: "Passat", year: 2020, title: "Passat 1.5 TSI Business 2020" };
    expect(hasFeature(car, "exterior", "parkingSensors")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(false);
  });

  it("VW Passat Elegance has LED Matrix, digital cockpit, keyless go, rear camera", () => {
    const car = { brand: "Volkswagen", model: "Passat", year: 2021, title: "Passat 2.0 TDI Elegance 2021" };
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
  });

  it("VW Tiguan Elegance has LED matrix, digital cockpit, ambient lighting, keyless access", () => {
    const car = { brand: "Volkswagen", model: "Tiguan", year: 2022, title: "Tiguan 1.5 TSI Elegance 2022" };
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  it("VW Taigo R-Line has sunroof, digital cockpit, LED matrix headlights", () => {
    const car = { brand: "Volkswagen", model: "Taigo", year: 2023, title: "Taigo 1.5 TSI R-Line 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
  });

  it("VW Arteon R-Line has digital cockpit, matrix headlights, ambient lighting and sunroof", () => {
    const car = { brand: "Volkswagen", model: "Arteon", year: 2022, title: "Arteon 2.0 TDI R-Line 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
  });

  // ==========================================
  // 2. RENAULT (Clio, Megane, Austral, Captur, Symbol, Taliant)
  // ==========================================
  it("Renault Clio Joy (base) excludes touchscreen, digital climate, rear camera, sunroof", () => {
    const car = { brand: "Renault", model: "Clio", year: 2021, title: "Renault Clio 1.0 TCe Joy 2021" };
    expect(hasFeature(car, "safety", "absEsp")).toBe(true);
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(false);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Renault Clio Touch has 7-inch touchscreen, CarPlay, parking sensors", () => {
    const car = { brand: "Renault", model: "Clio", year: 2021, title: "Renault Clio 1.0 TCe Touch 2021" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
    expect(hasFeature(car, "exterior", "parkingSensors")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Renault Clio Icon has LED Pure Vision, keyless card, rear camera, ambient lighting", () => {
    const car = { brand: "Renault", model: "Clio", year: 2021, title: "Renault Clio 1.0 TCe Icon 2021" };
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
  });

  it("Renault Clio RS Line has digital cockpit, LED headlights, ambient lighting, sport styling", () => {
    const car = { brand: "Renault", model: "Clio", year: 2022, title: "Renault Clio 1.3 TCe RS Line 2022" };
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
  });

  it("Renault Megane Joy (base) lacks touchscreen, carplay, sunroof", () => {
    const car = { brand: "Renault", model: "Megane", year: 2020, title: "Renault Megane 1.3 TCe Joy 2020" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Renault Megane Icon has 8.7-inch screen, ambient lighting, LED headlights, keyless", () => {
    const car = { brand: "Renault", model: "Megane", year: 2021, title: "Renault Megane 1.3 TCe Icon 2021" };
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
  });

  it("Renault Austral Techno Esprit Alpine has 360 camera, digital cockpit, electric tailgate, blind spot", () => {
    const car = { brand: "Renault", model: "Austral", year: 2023, title: "Renault Austral 1.3 TCe Techno Esprit Alpine 2023" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
  });

  it("Renault Taliant Touch has touchscreen, carplay, parking sensors", () => {
    const car = { brand: "Renault", model: "Taliant", year: 2022, title: "Renault Taliant 1.0 TCe Touch 2022" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
  });

  // ==========================================
  // 3. FIAT (Egea, Fiorino, Doblo, 500)
  // ==========================================
  it("Fiat Egea Easy (base) excludes touchscreen, carplay, digital climate, sunroof", () => {
    const car = { brand: "Fiat", model: "Egea", year: 2022, title: "Fiat Egea 1.4 Fire Easy 2022" };
    expect(hasFeature(car, "safety", "absEsp")).toBe(true);
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(false);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Fiat Egea Urban has 7-inch touchscreen, CarPlay, digital climate, rear sensors", () => {
    const car = { brand: "Fiat", model: "Egea", year: 2022, title: "Fiat Egea 1.3 Multijet Urban 2022" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(false);
  });

  it("Fiat Egea Lounge has digital cockpit, wireless charging, rear camera, keyless go", () => {
    const car = { brand: "Fiat", model: "Egea", year: 2022, title: "Fiat Egea 1.6 Multijet Lounge 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(false);
  });

  it("Fiat Egea Limited has leather seats, seat heating, blind spot, digital cockpit", () => {
    const car = { brand: "Fiat", model: "Egea", year: 2023, title: "Fiat Egea 1.6 Multijet Limited 2023" };
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
  });

  it("Fiat Fiorino Pop has ABS/Airbag but excludes touchscreen, camera, leather", () => {
    const car = { brand: "Fiat", model: "Fiorino", year: 2020, title: "Fiat Fiorino 1.3 Multijet Pop 2020" };
    expect(hasFeature(car, "safety", "absEsp")).toBe(true);
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
    expect(hasFeature(car, "exterior", "camera360")).toBe(false);
  });

  it("Fiat Fiorino Premio has touchscreen, bluetooth, parking sensors", () => {
    const car = { brand: "Fiat", model: "Fiorino", year: 2021, title: "Fiat Fiorino 1.3 Multijet Premio 2021" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "multimedia", "bluetooth")).toBe(true);
    expect(hasFeature(car, "exterior", "parkingSensors")).toBe(true);
  });

  it("Fiat Doblo Premio Plus has touchscreen, bluetooth, parking sensors", () => {
    const car = { brand: "Fiat", model: "Doblo", year: 2022, title: "Fiat Doblo Combi 1.6 Multijet Premio Plus 2022" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "exterior", "parkingSensors")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  // ==========================================
  // 4. FORD (Focus, Fiesta, Kuga, Puma, Mondeo, Tourneo)
  // ==========================================
  it("Ford Tourneo Connect 2009 cannot have 360 camera, seat cooling, carplay or digital cockpit", () => {
    const car = { brand: "Ford", model: "Tourneo Connect", year: 2009, title: "Ford Tourneo Connect 1.8 TDCi GLX 2009" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(false);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(false);
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(false);
    expect(hasFeature(car, "safety", "absEsp")).toBe(true);
  });

  it("Ford Focus Trend X (base) excludes sunroof, digital climate, digital cockpit", () => {
    const car = { brand: "Ford", model: "Focus", year: 2020, title: "Ford Focus 1.5 Ti-VCT Trend X 2020" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(false);
  });

  it("Ford Focus Titanium has SYNC CarPlay, keyless go, dual digital climate, rain sensor", () => {
    const car = { brand: "Ford", model: "Focus", year: 2021, title: "Ford Focus 1.5 EcoBlue Titanium 2021" };
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
    expect(hasFeature(car, "exterior", "rainSensor")).toBe(true);
  });

  it("Ford Focus ST-Line has digital cockpit, LED headlights, ambient lighting, sport styling", () => {
    const car = { brand: "Ford", model: "Focus", year: 2022, title: "Ford Focus 1.0 EcoBoost ST-Line 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
  });

  it("Ford Focus Vignale has leather seats, seat heating, premium audio, LED matrix", () => {
    const car = { brand: "Ford", model: "Focus", year: 2021, title: "Ford Focus 1.5 EcoBlue Vignale 2021" };
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
  });

  it("Ford Kuga ST-Line has digital cockpit, LED headlights, keyless go, carplay", () => {
    const car = { brand: "Ford", model: "Kuga", year: 2022, title: "Ford Kuga 1.5 EcoBoost ST-Line 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  // ==========================================
  // 5. HYUNDAI (i10, i20, Bayon, Elantra, Tucson)
  // ==========================================
  it("Hyundai i20 Jump (base) lacks touchscreen, rear camera, sunroof", () => {
    const car = { brand: "Hyundai", model: "i20", year: 2021, title: "Hyundai i20 1.4 MPI Jump 2021" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(false);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Hyundai i20 Style has 8-inch touchscreen, CarPlay, rear camera, parking sensors", () => {
    const car = { brand: "Hyundai", model: "i20", year: 2021, title: "Hyundai i20 1.4 MPI Style 2021" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
  });

  it("Hyundai i20 Elite has digital cockpit, sunroof, keyless go, ambient lighting", () => {
    const car = { brand: "Hyundai", model: "i20", year: 2022, title: "Hyundai i20 1.0 T-GDI Elite 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  it("Hyundai Bayon Elite has digital cockpit, sunroof, ambient lighting, keyless go", () => {
    const car = { brand: "Hyundai", model: "Bayon", year: 2023, title: "Hyundai Bayon 1.4 MPI Elite 2023" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
  });

  it("Hyundai Tucson Elite Plus has leather seats, seat heating, blind spot, lane assist, sunroof", () => {
    const car = { brand: "Hyundai", model: "Tucson", year: 2023, title: "Hyundai Tucson 1.6 CRDi Elite Plus 2023" };
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(false);
  });

  // ==========================================
  // 6. PEUGEOT (208, 308, 2008, 3008, 408, 5008)
  // ==========================================
  it("Peugeot 208 Active lacks sunroof, seat heating, 360 camera, leather seats", () => {
    const car = { brand: "Peugeot", model: "208", year: 2021, title: "Peugeot 208 1.2 PureTech Active 2021" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(false);
    expect(hasFeature(car, "exterior", "camera360")).toBe(false);
  });

  it("Peugeot 208 Allure has i-Cockpit, rear camera, digital climate, keyless start", () => {
    const car = { brand: "Peugeot", model: "208", year: 2022, title: "Peugeot 208 1.2 PureTech Allure 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  it("Peugeot 208 GT has 3D i-Cockpit, full LED claw, ambient lighting, lane assist, heated seats", () => {
    const car = { brand: "Peugeot", model: "208", year: 2023, title: "Peugeot 208 1.2 PureTech GT 2023" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
  });

  it("Peugeot 3008 GT has full LED, ambient lighting, lane assist, blind spot, heated seats", () => {
    const car = { brand: "Peugeot", model: "3008", year: 2022, title: "Peugeot 3008 1.5 BlueHDi GT 2022" };
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
  });

  // ==========================================
  // 7. TOYOTA (Corolla, Yaris, C-HR, RAV4)
  // ==========================================
  it("Toyota Corolla Vision (base) excludes sunroof, heated seats, rear camera, 360 camera", () => {
    const car = { brand: "Toyota", model: "Corolla", year: 2021, title: "Toyota Corolla 1.5 Vision 2021" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(false);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(false);
  });

  it("Toyota Corolla Dream has touchscreen, rear camera, dual zone digital climate, carplay", () => {
    const car = { brand: "Toyota", model: "Corolla", year: 2021, title: "Toyota Corolla 1.5 Dream 2021" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Toyota Corolla Flame has keyless go, LED headlights, folding mirrors, rain sensor", () => {
    const car = { brand: "Toyota", model: "Corolla", year: 2022, title: "Toyota Corolla 1.5 Flame X-Pack 2022" };
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "exterior", "foldingMirrors")).toBe(true);
  });

  it("Toyota Corolla Passion has sunroof, seat heating, wireless charging, blind spot", () => {
    const car = { brand: "Toyota", model: "Corolla", year: 2023, title: "Toyota Corolla 1.5 Passion X-Pack 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "multimedia", "wirelessCharging")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  it("Toyota C-HR Passion has heated seats, blind spot, keyless go, LED headlights", () => {
    const car = { brand: "Toyota", model: "C-HR", year: 2022, title: "Toyota C-HR 1.8 Hybrid Passion 2022" };
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  // ==========================================
  // 8. HONDA (Civic, City, HR-V, CR-V)
  // ==========================================
  it("Honda Civic Elegance has electric sunroof, heated seats, rear camera, parking sensors", () => {
    const car = { brand: "Honda", model: "Civic", year: 2021, title: "Honda Civic 1.5 VTEC Elegance 2021" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
    expect(hasFeature(car, "exterior", "parkingSensors")).toBe(true);
  });

  it("Honda Civic Executive has leather seats, wireless charging, blind spot, keyless, LED", () => {
    const car = { brand: "Honda", model: "Civic", year: 2022, title: "Honda Civic 1.5 VTEC Executive Plus 2022" };
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "multimedia", "wirelessCharging")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
  });

  // ==========================================
  // 9. OPEL (Corsa, Astra, Mokka, Grandland)
  // ==========================================
  it("Opel Corsa Essentia (base) lacks sunroof, heated seats, digital cockpit, 360 camera", () => {
    const car = { brand: "Opel", model: "Corsa", year: 2021, title: "Opel Corsa 1.2 Essentia 2021" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(false);
  });

  it("Opel Corsa GS Line has Pure Panel digital cockpit, LED headlights, ambient lighting", () => {
    const car = { brand: "Opel", model: "Corsa", year: 2022, title: "Opel Corsa 1.2 Turbo GS Line 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
  });

  it("Opel Astra Ultimate has IntelliLux LED, heated seats, heated steering, blind spot", () => {
    const car = { brand: "Opel", model: "Astra", year: 2023, title: "Opel Astra 1.2 Turbo Ultimate 2023" };
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "comfort", "heatedSteering")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  it("Opel Grandland Ultimate has heated seats, heated steering, blind spot, matrix LED", () => {
    const car = { brand: "Opel", model: "Grandland", year: 2022, title: "Opel Grandland 1.5 D Ultimate 2022" };
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "comfort", "heatedSteering")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  // ==========================================
  // 10. NISSAN (Qashqai, Juke, X-Trail)
  // ==========================================
  it("Nissan Qashqai Visia lacks sunroof, heated seats, 360 camera, touchscreen", () => {
    const car = { brand: "Nissan", model: "Qashqai", year: 2021, title: "Nissan Qashqai 1.3 DIG-T Visia 2021" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "exterior", "camera360")).toBe(false);
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
  });

  it("Nissan Qashqai Tekna has touchscreen, rear camera, digital climate, keyless go", () => {
    const car = { brand: "Nissan", model: "Qashqai", year: 2022, title: "Nissan Qashqai 1.3 DIG-T Tekna 2022" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  it("Nissan Qashqai Platinum has 360 camera, sunroof, leather seats, heated seats, blind spot", () => {
    const car = { brand: "Nissan", model: "Qashqai", year: 2023, title: "Nissan Qashqai 1.3 DIG-T Platinum Premium 2023" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  // ==========================================
  // 11. SKODA (Fabia, Octavia, Superb, Kodiaq)
  // ==========================================
  it("Skoda Octavia Style has Virtual Cockpit, matrix LED, keyless go, rear camera", () => {
    const car = { brand: "Skoda", model: "Octavia", year: 2022, title: "Skoda Octavia 1.5 e-TEC Style 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
  });

  it("Skoda Superb L&K has Canton audio, ventilated seats, matrix LED, electric tailgate", () => {
    const car = { brand: "Skoda", model: "Superb", year: 2022, title: "Skoda Superb 2.0 TDI Laurin & Klement Crystal 2022" };
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  it("Skoda Kodiaq Sportline has panoramic sunroof, sport seats, ambient lighting, matrix LED", () => {
    const car = { brand: "Skoda", model: "Kodiaq", year: 2023, title: "Skoda Kodiaq 1.5 TSI Sportline 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
  });

  // ==========================================
  // 12. BMW (1, 2, 3, 4, 5, X1, X3)
  // ==========================================
  it("BMW 118i Sport Line has digital cockpit, LED headlights, ambient lighting, keyless go", () => {
    const car = { brand: "BMW", model: "118i", year: 2021, title: "BMW 118i Sport Line 2021" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(false);
  });

  it("BMW 320i M Sport has panoramic glass roof/sunroof, M sport styling, digital cockpit", () => {
    const car = { brand: "BMW", model: "320i", year: 2022, title: "BMW 320i Sedan M Sport 2022" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "comfort", "heatedSteering")).toBe(false);
  });

  it("BMW 520i Luxury Line has genuine leather seats, electric memory seats, ambient lighting", () => {
    const car = { brand: "BMW", model: "520i", year: 2022, title: "BMW 520i Sedan Luxury Line 2022" };
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "electricSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
  });

  it("BMW X3 M Sport has panoramic sunroof, M sport styling, digital cockpit, ambient lighting", () => {
    const car = { brand: "BMW", model: "X3", year: 2023, title: "BMW X3 sDrive20i M Sport 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
  });

  // ==========================================
  // 13. MERCEDES-BENZ (A, C, E, GLC, EQS)
  // ==========================================
  it("Mercedes-Benz C 200 AMG Line has panoramic sunroof, 64-color ambient, sport seats", () => {
    const car = { brand: "Mercedes-Benz", model: "C 200", year: 2023, title: "Mercedes - Benz C 200 4MATIC AMG 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(false);
  });

  it("Mercedes-Benz E 200 Exclusive has leather seats, electric memory seats, open-pore wood", () => {
    const car = { brand: "Mercedes-Benz", model: "E 200", year: 2022, title: "Mercedes - Benz E 200 d Exclusive 2022" };
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "electricSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
  });

  it("Mercedes GLC 43 AMG Performance has 360 camera, heated sport seats, electric tailgate, blind spot", () => {
    const car = { brand: "Mercedes-Benz", model: "GLC 43 AMG", year: 2024, title: "Mercedes - Benz GLC Coupe 43 AMG 2024" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  it("Mercedes EQS 580 Heritage Edition has Hyperscreen, 360 camera, cooled & heated seats, air suspension", () => {
    const car = { brand: "Mercedes-Benz", model: "EQS 580", year: 2023, title: "Mercedes - Benz EQS 580 Heritage Edition 2023" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "safety", "adaptiveCruise")).toBe(true);
  });

  // ==========================================
  // 14. AUDI (A3, A4, A6, Q3, RS)
  // ==========================================
  it("Audi A3 Advanced has Virtual Cockpit, LED headlights, digital climate, CarPlay", () => {
    const car = { brand: "Audi", model: "A3", year: 2022, title: "Audi A3 Sedan 35 TFSI Advanced 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(false);
  });

  it("Audi A3 S line has panoramic sunroof, S line sport seats, ambient lighting", () => {
    const car = { brand: "Audi", model: "A3", year: 2023, title: "Audi A3 Sportback 35 TFSI S line 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
  });

  it("Audi RS 6 Performance has 360 camera, sunroof, leather seats, Bang & Olufsen audio, blind spot", () => {
    const car = { brand: "Audi", model: "RS6", year: 2023, title: "Audi RS 6 Avant 4.0 TFSI 2023" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  // ==========================================
  // 15. SEAT & CUPRA (Leon, Ibiza, Formentor)
  // ==========================================
  it("Seat Leon Reference (base) lacks digital cockpit, ambient lighting, sunroof", () => {
    const car = { brand: "Seat", model: "Leon", year: 2021, title: "Seat Leon 1.0 TSI Reference 2021" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(false);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Seat Leon FR has panoramic sunroof, digital cockpit, LED headlights, ambient lighting", () => {
    const car = { brand: "Seat", model: "Leon", year: 2022, title: "Seat Leon 1.5 eTSI FR 2022" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
  });

  it("Cupra Formentor VZ has bucket leather seats, electric tailgate, digital cockpit, lane assist", () => {
    const car = { brand: "Cupra", model: "Formentor", year: 2023, title: "Cupra Formentor 2.0 TSI VZ 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
  });

  // ==========================================
  // 16. DACIA (Duster, Sandero, Jogger)
  // ==========================================
  it("Dacia Sandero Essential lacks touchscreen, rear camera, sunroof", () => {
    const car = { brand: "Dacia", model: "Sandero", year: 2022, title: "Dacia Sandero 1.0 SCe Essential 2022" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(false);
  });

  it("Dacia Duster Prestige has Media Nav touchscreen, rear camera, blind spot, digital climate", () => {
    const car = { brand: "Dacia", model: "Duster", year: 2023, title: "Dacia Duster 1.3 TCe Prestige 2023" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(false);
  });

  it("Dacia Jogger Extreme has touchscreen, CarPlay, rear camera, blind spot", () => {
    const car = { brand: "Dacia", model: "Jogger", year: 2023, title: "Dacia Jogger 1.0 TCe Extreme 2023" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "exterior", "rearCamera")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  // ==========================================
  // 17. KIA (Sportage, Ceed, Stonic)
  // ==========================================
  it("Kia Ceed Cool (base) lacks touchscreen, heated seats, sunroof", () => {
    const car = { brand: "Kia", model: "Ceed", year: 2021, title: "Kia Ceed 1.0 T-GDI Cool 2021" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Kia Sportage Prestige has dual curved screen, heated seats & steering, sunroof, keyless", () => {
    const car = { brand: "Kia", model: "Sportage", year: 2023, title: "Kia Sportage 1.6 T-GDI Prestige 2023" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  it("Kia Sportage GT-Line has 360 camera, ventilated & heated seats, smart tailgate, blind spot", () => {
    const car = { brand: "Kia", model: "Sportage", year: 2024, title: "Kia Sportage 1.6 T-GDI GT-Line 2024" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  // ==========================================
  // 18. CITROEN (C3, C4, C5 Aircross)
  // ==========================================
  it("Citroen C3 Live (base) lacks touchscreen, digital climate, sunroof", () => {
    const car = { brand: "Citroen", model: "C3", year: 2021, title: "Citroen C3 1.2 PureTech Live 2021" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(false);
  });

  it("Citroen C4 Shine has digital cockpit, keyless go, blind spot, LED headlights, ambient lighting", () => {
    const car = { brand: "Citroen", model: "C4", year: 2022, title: "Citroen C4 1.2 PureTech Shine 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
  });

  it("Citroen C5 Aircross Shine has digital cockpit, rear camera, blind spot, keyless go", () => {
    const car = { brand: "Citroen", model: "C5 Aircross", year: 2023, title: "Citroen C5 Aircross 1.5 BlueHDi Shine 2023" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  // ==========================================
  // 19. VOLVO (XC40, XC60, XC90, S60, S90)
  // ==========================================
  it("Volvo XC40 Momentum has Google built-in, digital cluster, Thor's Hammer LED, dual zone AC", () => {
    const car = { brand: "Volvo", model: "XC40", year: 2022, title: "Volvo XC40 B4 Momentum 2022" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
  });

  it("Volvo XC60 Inscription has panoramic sunroof, leather seats, heated seats, Harman Kardon, blind spot", () => {
    const car = { brand: "Volvo", model: "XC60", year: 2022, title: "Volvo XC60 B5 Inscription 2022" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  it("Volvo XC90 Ultimate has air suspension, panoramic roof, Bowers & Wilkins sound, electric tailgate", () => {
    const car = { brand: "Volvo", model: "XC90", year: 2023, title: "Volvo XC90 B6 Ultimate 2023" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
  });

  // ==========================================
  // 20. CHERY (Omoda 5, Tiggo 7 Pro, Tiggo 8 Pro)
  // ==========================================
  it("Chery Omoda 5 Luxury has 360 camera, panoramic sunroof, electric tailgate, wireless charging", () => {
    const car = { brand: "Chery", model: "Omoda 5", year: 2023, title: "Chery Omoda 5 Luxury 2023" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
    expect(hasFeature(car, "multimedia", "wirelessCharging")).toBe(true);
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(false);
  });

  it("Chery Tiggo 8 Pro Excellence has ventilated & heated seats, 360 camera, Sony audio, ADAS level 2", () => {
    const car = { brand: "Chery", model: "Tiggo 8 Pro", year: 2024, title: "Chery Tiggo 8 Pro Excellence 2024" };
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "safety", "adaptiveCruise")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
  });

  // ==========================================
  // 21. TESLA & TOGG (Unified EV Standard)
  // ==========================================
  it("Tesla Model Y standard hardware features Autopilot, 360 camera suite, heated seats, glass roof", () => {
    const car = { brand: "Tesla", model: "Model Y", year: 2023, title: "Tesla Model Y Long Range 2023" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "safety", "adaptiveCruise")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
  });

  it("Togg T10X V1 has digital end-to-end screen, LED headlights, keyless start", () => {
    const car = { brand: "Togg", model: "T10X", year: 2024, title: "Togg T10X V1 2024" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(false);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("Togg T10X V2 has 360 camera, glass roof, heated seats, Meridian audio, wireless charging", () => {
    const car = { brand: "Togg", model: "T10X", year: 2024, title: "Togg T10X V2 2024" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  // ==========================================
  // 22. PORSCHE (Macan, Cayenne, Taycan, Panamera)
  // ==========================================
  it("Porsche Macan Turbo 2025 verifies Matrix LED, 360 camera, Sport Chrono, heated seats, sunroof", () => {
    const car = {
      brand: "Porsche",
      model: "Macan Turbo",
      year: 2025,
      title: "VOSMER 2025 PORSCHE MACAN TURBO ELEKTRİK 639 HP 4X4",
      description: "LED MATRİX + PANORAMİK CAM TAVAN + 360 KAMERA",
    };
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
  });

  it("Porsche Cayenne GTS has adaptive sport seats, air suspension, matrix headlights, 360 camera", () => {
    const car = { brand: "Porsche", model: "Cayenne", year: 2022, title: "Porsche Cayenne GTS Coupe 2022" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
  });

  // ==========================================
  // 23. ADDITIONAL BRANDS (Subaru, Lexus, DS, Mazda, Mitsubishi, SsangYong, BYD, Jaguar, Maserati)
  // ==========================================
  it("Subaru XV Premium has EyeSight lane assist, sunroof, heated leather seats", () => {
    const car = { brand: "Subaru", model: "XV", year: 2022, title: "Subaru XV 1.6i Premium 2022" };
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
  });

  it("Lexus RX Executive has ventilated seats, 360 camera, panoramic sunroof, premium audio", () => {
    const car = { brand: "Lexus", model: "RX", year: 2023, title: "Lexus RX 350h Executive 2023" };
    expect(hasFeature(car, "comfort", "seatCooling")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
  });

  it("DS 7 Opera has watchstrap leather, 360 camera, panoramic sunroof, heated seats", () => {
    const car = { brand: "DS", model: "DS 7", year: 2023, title: "DS 7 BlueHDi Opera 2023" };
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
  });

  it("Mazda CX-5 Power Sense has Bose audio, sunroof, heated leather seats, blind spot, lane assist", () => {
    const car = { brand: "Mazda", model: "CX-5", year: 2022, title: "Mazda CX-5 2.0 SkyActiv Power Sense 2022" };
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  it("Mitsubishi Eclipse Cross Instyle has touchscreen, CarPlay, rear camera, keyless go", () => {
    const car = { brand: "Mitsubishi", model: "Eclipse Cross", year: 2022, title: "Mitsubishi Eclipse Cross 1.5 Instyle 2022" };
    expect(hasFeature(car, "multimedia", "touchScreen")).toBe(true);
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  it("SsangYong Torres Platinum has digital cockpit, sunroof, heated seats, lane assist", () => {
    const car = { brand: "SsangYong", model: "Torres", year: 2023, title: "KGM SsangYong Torres 1.5 T-GDI Platinum 2023" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
  });

  it("BYD Atto 3 Design has 360 camera, panoramic roof, heated seats, electric tailgate, adaptive cruise", () => {
    const car = { brand: "BYD", model: "Atto 3", year: 2024, title: "BYD Atto 3 Design 2024" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
    expect(hasFeature(car, "safety", "adaptiveCruise")).toBe(true);
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
  });

  it("Jaguar F-Pace R-Dynamic has Meridian audio, 360 camera, panoramic roof, electric memory seats", () => {
    const car = { brand: "Jaguar", model: "F-Pace", year: 2023, title: "Jaguar F-Pace 2.0 D R-Dynamic HSE 2023" };
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
  });

  it("Maserati Ghibli Trofeo has leather sport seats, 360 camera, premium audio, electric tailgate", () => {
    const car = { brand: "Maserati", model: "Ghibli", year: 2022, title: "Maserati Ghibli Trofeo 2022" };
    expect(hasFeature(car, "comfort", "leatherSeats")).toBe(true);
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
  });

  // ==========================================
  // 24. JARGON, ABBREVIATIONS & STANDALONE KEYWORDS
  // ==========================================
  it("recognizes standalone 'HAYALET' buzzword in descriptions", () => {
    const car = { brand: "BMW", model: "320i", year: 2020, title: "320i", description: "CAM TAVAN + HAYALET + NBT" };
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(true);
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
  });

  it("recognizes 'CAMTAVAN' without space", () => {
    const car = { brand: "Seat", model: "Leon", year: 2020, title: "Leon", description: "CAMTAVAN MEVCUTTUR" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
  });

  it("recognizes 'PANAROMİK' misspelling", () => {
    const car = { brand: "Peugeot", model: "3008", year: 2021, title: "3008", description: "PANAROMİK AÇILIR TAVAN" };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
  });

  it("recognizes 'BLIS' (Volvo Blind Spot)", () => {
    const car = { brand: "Volvo", model: "S60", year: 2021, title: "S60", description: "GÜVENLİK : BLIS + PILOT ASSIST" };
    expect(hasFeature(car, "safety", "blindSpot")).toBe(true);
    expect(hasFeature(car, "safety", "adaptiveCruise")).toBe(true);
  });

  it("recognizes 'CITY SAFETY' (Volvo Emergency Brake)", () => {
    const car = { brand: "Volvo", model: "XC60", year: 2020, title: "XC60", description: "CITY SAFETY ÇARPIŞMA ENGELLEME" };
    expect(hasFeature(car, "safety", "emergencyBrake")).toBe(true);
  });

  it("recognizes 'TRAVEL ASSIST' (VAG Group ACC)", () => {
    const car = { brand: "Volkswagen", model: "Passat", year: 2022, title: "Passat", description: "TRAVEL ASSIST İLE OTONOM SÜRÜŞ" };
    expect(hasFeature(car, "safety", "adaptiveCruise")).toBe(true);
  });

  it("recognizes 'DISTRONIC' (Mercedes ACC)", () => {
    const car = { brand: "Mercedes-Benz", model: "E 200", year: 2021, title: "E 200", description: "DISTRONIC PLUS MESAFE TAKİP" };
    expect(hasFeature(car, "safety", "adaptiveCruise")).toBe(true);
  });

  it("recognizes 'KESSY' (VAG Keyless)", () => {
    const car = { brand: "Skoda", model: "Octavia", year: 2021, title: "Octavia", description: "KESSY ANAHTARSIZ GİRİŞ VE ÇIKIŞ" };
    expect(hasFeature(car, "comfort", "keylessGo")).toBe(true);
  });

  it("recognizes 'APP-CONNECT' (VW CarPlay)", () => {
    const car = { brand: "Volkswagen", model: "Polo", year: 2021, title: "Polo", description: "APP-CONNECT AKTİFTİR" };
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
  });

  it("recognizes 'FULL LINK' (Seat CarPlay)", () => {
    const car = { brand: "Seat", model: "Ibiza", year: 2021, title: "Ibiza", description: "FULL LINK KABLOSUZ BAĞLANTI" };
    expect(hasFeature(car, "multimedia", "carplayAndroidAuto")).toBe(true);
  });

  it("recognizes 'INTELLILUX' (Opel Matrix LED)", () => {
    const car = { brand: "Opel", model: "Corsa", year: 2022, title: "Corsa", description: "INTELLILUX LED FARLAR" };
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
  });

  it("recognizes 'CANTON' (Skoda Audio)", () => {
    const car = { brand: "Skoda", model: "Superb", year: 2021, title: "Superb", description: "CANTON MÜZİK SİSTEMİ" };
    expect(hasFeature(car, "multimedia", "premiumAudio")).toBe(true);
  });

  it("recognizes 'IŞIK PAKET' (BMW Ambient)", () => {
    const car = { brand: "BMW", model: "320i", year: 2020, title: "320i", description: "IŞIK PAKET VE AMBİYANS AYDINLATMA" };
    expect(hasFeature(car, "comfort", "ambientLighting")).toBe(true);
  });

  it("recognizes 'VAKUMLU BAGAJ' (Electric Tailgate)", () => {
    const car = { brand: "Audi", model: "A6", year: 2021, title: "A6", description: "VAKUMLU BAGAJ VE KAPILAR" };
    expect(hasFeature(car, "exterior", "electricTailgate")).toBe(true);
  });

  it("recognizes 'ÇEVRE KAMERASI' (360 Camera)", () => {
    const car = { brand: "Nissan", model: "Qashqai", year: 2022, title: "Qashqai", description: "ÇEVRE KAMERASI MEVCUT" };
    expect(hasFeature(car, "exterior", "camera360")).toBe(true);
  });

  // ==========================================
  // 25. NEGATION & EDGE CASES
  // ==========================================
  it("rejects 'cam tavan hariç en dolusu' for sunroof", () => {
    const car = { brand: "Volkswagen", model: "Golf", year: 2020, title: "Golf", description: "Cam tavan hariç en dolusu." };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("rejects 'koltuk ısıtma yoktur' for seat heating", () => {
    const car = { brand: "BMW", model: "320i", year: 2021, title: "320i", description: "Koltuk ısıtma yoktur." };
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(false);
  });

  it("rejects 'sunroof bulunmuyor'", () => {
    const car = { brand: "Mercedes-Benz", model: "A 200", year: 2021, title: "A 200", description: "Sunroof bulunmamaktadır." };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("does not let 'HASAR KAYDI : YOKTUR' cancel genuine features", () => {
    const car = {
      brand: "Volkswagen",
      model: "Golf",
      year: 2022,
      title: "Golf R-Line",
      description: "LED MATRIX + PANORAMİK CAM TAVAN HASAR KAYDI : YOKTUR",
    };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(true);
    expect(hasFeature(car, "exterior", "ledMatrixHeadlights")).toBe(true);
  });

  it("does not assign R-Line if text says 'R-Line görünümlü body kit'", () => {
    const car = {
      brand: "Volkswagen",
      model: "Golf",
      year: 2020,
      title: "Volkswagen Golf 1.0 TSI Trendline",
      description: "Trendline araçtır, dıştan R-Line görünümlü body kit takılmıştır.",
    };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
    expect(hasFeature(car, "comfort", "digitalCockpit")).toBe(false);
  });

  it("does not assign AMG package if text says 'AMG görünümlü tampon'", () => {
    const car = {
      brand: "Mercedes-Benz",
      model: "C 200",
      year: 2020,
      title: "Mercedes C 200 Style",
      description: "Aracımız Style paket olup AMG görünümlü tampon eklenmiştir.",
    };
    expect(hasFeature(car, "exterior", "sunroof")).toBe(false);
  });

  it("normalizes Turkish capital 'İ' in 'ŞERİT TAKİP' and 'DİJİTAL KLİMA'", () => {
    const car = {
      brand: "Toyota",
      model: "Corolla",
      year: 2022,
      title: "Corolla",
      description: "ŞERİT TAKİP SİSTEMİ + DİJİTAL KLİMA + ISITMALI KOLTUK",
    };
    expect(hasFeature(car, "safety", "laneAssist")).toBe(true);
    expect(hasFeature(car, "comfort", "digitalClimate")).toBe(true);
    expect(hasFeature(car, "comfort", "seatHeating")).toBe(true);
  });
});
