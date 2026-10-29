import { describe, it, expect } from "vitest";
import { evaluateCarEquipment } from "./car-equipment";

describe("car-equipment with trim packages", () => {
  it("prevents modern impossible tech on older commercial vans even if seller claims it", () => {
    // 2009 Ford Tourneo Connect ile satıcının abartıp "360 kamera, koltuk soğutma, carplay" yazdığı senaryo
    const equipment = evaluateCarEquipment({
      brand: "Ford",
      model: "Tourneo Connect",
      year: 2009,
      vehicleClass: "minivan",
      title: "Sahibinden Ford Tourneo Connect 1.8 TDCI GLX 2009 Model",
      description: "Aracım full+full 360 kamera, koltuk soğutma, apple carplay ve hayalet ekran mevcuttur.",
    });

    const exterior = equipment.find((c) => c.id === "exterior")!;
    const comfort = equipment.find((c) => c.id === "comfort")!;
    const multimedia = equipment.find((c) => c.id === "multimedia")!;
    const safety = equipment.find((c) => c.id === "safety")!;

    expect(exterior.items.find((i) => i.id === "camera360")!.present).toBe(false);
    expect(comfort.items.find((i) => i.id === "seatCooling")!.present).toBe(false);
    expect(multimedia.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(false);
    expect(comfort.items.find((i) => i.id === "digitalCockpit")!.present).toBe(false);
    expect(safety.items.find((i) => i.id === "absEsp")!.present).toBe(true);
  });

  it("verifies standard and stated equipment on modern luxury EVs (Mercedes EQS)", () => {
    const equipment = evaluateCarEquipment({
      brand: "Mercedes-Benz",
      model: "EQS 580 Heritage Edition",
      year: 2023,
      vehicleClass: "sedan",
      title: "Sahibinden Mercedes - Benz EQS 580 2023",
      description: "Isıtmalı ve Soğutmalı Ön Koltuklar, Burmester ses sistemi, Panoramik cam tavan",
      features: { fuelType: "Elektrik" },
    });

    const exterior = equipment.find((c) => c.id === "exterior")!;
    const comfort = equipment.find((c) => c.id === "comfort")!;
    const multimedia = equipment.find((c) => c.id === "multimedia")!;
    const safety = equipment.find((c) => c.id === "safety")!;

    expect(exterior.items.find((i) => i.id === "camera360")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "seatCooling")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "seatHeating")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "digitalCockpit")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "sunroof")!.present).toBe(true);
    expect(multimedia.items.find((i) => i.id === "premiumAudio")!.present).toBe(true);
    expect(safety.items.find((i) => i.id === "adaptiveCruise")!.present).toBe(true);
  });

  it("correctly distinguishes Fiat Egea Easy (base) vs Lounge (top) packages", () => {
    const egeaEasy = evaluateCarEquipment({
      brand: "Fiat",
      model: "Egea",
      year: 2022,
      vehicleClass: "sedan",
      title: "Galeriden Fiat Egea 1.4 Fire Easy 2022 Model",
    });

    const easyMul = egeaEasy.find((c) => c.id === "multimedia")!;
    const easyExt = egeaEasy.find((c) => c.id === "exterior")!;
    const easyCom = egeaEasy.find((c) => c.id === "comfort")!;

    // Easy paketinde dokunmatik ekran, carplay, sunroof, dijital klima YOKTUR
    expect(easyMul.items.find((i) => i.id === "touchScreen")!.present).toBe(false);
    expect(easyMul.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(false);
    expect(easyExt.items.find((i) => i.id === "sunroof")!.present).toBe(false);
    expect(easyCom.items.find((i) => i.id === "digitalClimate")!.present).toBe(false);

    const egeaLounge = evaluateCarEquipment({
      brand: "Fiat",
      model: "Egea",
      year: 2022,
      vehicleClass: "sedan",
      title: "Galeriden Fiat Egea 1.6 Multijet Lounge 2022 Model",
    });

    const loungeMul = egeaLounge.find((c) => c.id === "multimedia")!;
    const loungeCom = egeaLounge.find((c) => c.id === "comfort")!;

    // Lounge paketinde dokunmatik ekran, carplay, dijital klima, keyless STANDARTTIR
    expect(loungeMul.items.find((i) => i.id === "touchScreen")!.present).toBe(true);
    expect(loungeMul.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);
    expect(loungeCom.items.find((i) => i.id === "digitalClimate")!.present).toBe(true);
    expect(loungeCom.items.find((i) => i.id === "keylessGo")!.present).toBe(true);
  });

  it("recognizes Chery Tiggo 8 Pro Excellence top package with ventilated seats & 360 camera", () => {
    const chery = evaluateCarEquipment({
      brand: "Chery",
      model: "Tiggo 8 Pro",
      year: 2024,
      title: "Chery Tiggo 8 Pro Excellence 2024 Model",
    });

    const cheryCom = chery.find((c) => c.id === "comfort")!;
    const cheryExt = chery.find((c) => c.id === "exterior")!;
    const cherySaf = chery.find((c) => c.id === "safety")!;

    // Excellence paketinde koltuk soğutma, koltuk ısıtma, 360 kamera ve cam tavan standarttır
    expect(cheryCom.items.find((i) => i.id === "seatCooling")!.present).toBe(true);
    expect(cheryCom.items.find((i) => i.id === "seatHeating")!.present).toBe(true);
    expect(cheryExt.items.find((i) => i.id === "camera360")!.present).toBe(true);
    expect(cheryExt.items.find((i) => i.id === "sunroof")!.present).toBe(true);
    expect(cherySaf.items.find((i) => i.id === "laneAssist")!.present).toBe(true);
  });

  it("handles negative statements correctly (e.g., 'sunroof hariç', 'koltuk ısıtma yok')", () => {
    const equipment = evaluateCarEquipment({
      brand: "Volkswagen",
      model: "Golf",
      year: 2018,
      vehicleClass: "hatchback",
      title: "Golf 1.4 TSI Highline",
      description: "Araç çok temizdir. Cam tavan hariç en dolusu, koltuk ısıtma yoktur.",
    });

    const exterior = equipment.find((c) => c.id === "exterior")!;
    const comfort = equipment.find((c) => c.id === "comfort")!;

    expect(exterior.items.find((i) => i.id === "sunroof")!.present).toBe(false);
    expect(comfort.items.find((i) => i.id === "seatHeating")!.present).toBe(false);
  });

  it("does not let 'HASAR KAYDI : YOKTUR' negate features across distant text in 2025 Porsche Macan Turbo", () => {
    const equipment = evaluateCarEquipment({
      brand: "Porsche",
      model: "Macan 3.6 Turbo",
      year: 2025,
      vehicleClass: "suv",
      title: "VOSMER 2025 PORSCHE MACAN TURBO ELEKTRİK 639 HP 4X4",
      description:
        "EK DONANIM :KARŞILAMA IŞIĞI + AKTİF PARK - ÇEVRE GÖRÜŞ SİSTEMİ + SPORT CHRONO PAKET + LED MATRİX - DYNAMİC FARLAR + PANORAMİK CAM TAVAN HASAR KAYDI : YOKTUR",
      features: {
        fuelType: "Elektrik",
        transmission: "Otomatik",
        bodyType: "SUV",
      },
    });

    const exterior = equipment.find((c) => c.id === "exterior")!;
    const comfort = equipment.find((c) => c.id === "comfort")!;
    const safety = equipment.find((c) => c.id === "safety")!;
    const multimedia = equipment.find((c) => c.id === "multimedia")!;

    // Panoramik cam tavan ve Matrix LED, hasar kaydı yoktur yazısına rağmen 'true' olmalı
    expect(exterior.items.find((i) => i.id === "sunroof")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "ledMatrixHeadlights")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "camera360")!.present).toBe(true);
    expect(safety.items.find((i) => i.id === "laneAssist")!.present).toBe(true);
    expect(safety.items.find((i) => i.id === "blindSpot")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "seatHeating")!.present).toBe(true);
    expect(multimedia.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);
  });

  it("verifies 2024 Mercedes GLC 43 AMG standard equipment even with empty seller description", () => {
    const glc = evaluateCarEquipment({
      brand: "Mercedes-Benz",
      model: "GLC Coupe 43 AMG",
      year: 2024,
      vehicleClass: "suv",
      title: "Galeriden Mercedes - Benz GLC Coupe 43 AMG 2024 Model İstanbul 26.500 KM",
      description: "Arabam ilanı",
    });

    const safety = glc.find((c) => c.id === "safety")!;
    const comfort = glc.find((c) => c.id === "comfort")!;
    const exterior = glc.find((c) => c.id === "exterior")!;
    const multimedia = glc.find((c) => c.id === "multimedia")!;

    // 2024 AMG SUV: GSR II zorunlu şerit takip ve acil fren, AMG ve D-SUV fabrika standartları
    expect(safety.items.find((i) => i.id === "laneAssist")!.present).toBe(true);
    expect(safety.items.find((i) => i.id === "emergencyBrake")!.present).toBe(true);
    expect(safety.items.find((i) => i.id === "blindSpot")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "seatHeating")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "electricSeats")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "digitalCockpit")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "ambientLighting")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "digitalClimate")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "keylessGo")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "camera360")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "electricTailgate")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "ledMatrixHeadlights")!.present).toBe(true);
    expect(multimedia.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);
  });

  it("verifies 2024 Audi Q3 35 TFSI Advanced package equipment", () => {
    const q3 = evaluateCarEquipment({
      brand: "Audi",
      model: "Q3 35 TFSI Advanced",
      year: 2024,
      vehicleClass: "suv",
      title: "Galeriden Audi Q3 35 TFSI Advanced 2024 Model Malatya 47.000 KM Siyah",
      description: "",
    });

    const safety = q3.find((c) => c.id === "safety")!;
    const comfort = q3.find((c) => c.id === "comfort")!;
    const exterior = q3.find((c) => c.id === "exterior")!;
    const multimedia = q3.find((c) => c.id === "multimedia")!;

    // Audi Advanced + 2024 GSR II
    expect(safety.items.find((i) => i.id === "laneAssist")!.present).toBe(true);
    expect(safety.items.find((i) => i.id === "emergencyBrake")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "digitalCockpit")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "digitalClimate")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "keylessGo")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "ledMatrixHeadlights")!.present).toBe(true);
    expect(multimedia.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);
    // Koltuk soğutma Q3 standartında yoktur
    expect(comfort.items.find((i) => i.id === "seatCooling")!.present).toBe(false);
  });

  it("verifies 2021 BMW 118i Sport Line equipment", () => {
    const bmw = evaluateCarEquipment({
      brand: "BMW",
      model: "1 Serisi 118i Sport Line",
      year: 2021,
      vehicleClass: "hatchback",
      title: "Galeriden BMW 1 Serisi 118i Sport Line 2021 Model İzmir 43.980 KM",
      description: "",
    });

    const safety = bmw.find((c) => c.id === "safety")!;
    const comfort = bmw.find((c) => c.id === "comfort")!;
    const exterior = bmw.find((c) => c.id === "exterior")!;
    const multimedia = bmw.find((c) => c.id === "multimedia")!;

    // 2021 BMW 1 Serisi Sport Line: Dijital kokpit, LED, CarPlay, park sensörü var
    expect(comfort.items.find((i) => i.id === "digitalCockpit")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "digitalClimate")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "keylessGo")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "ledMatrixHeadlights")!.present).toBe(true);
    expect(multimedia.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);
    // C-segment hatchback Sport Line: 360 kamera, koltuk soğutma, elektrikli bagaj standart DEĞİLDİR
    expect(exterior.items.find((i) => i.id === "camera360")!.present).toBe(false);
    expect(comfort.items.find((i) => i.id === "seatCooling")!.present).toBe(false);
    expect(exterior.items.find((i) => i.id === "electricTailgate")!.present).toBe(false);
  });
});
