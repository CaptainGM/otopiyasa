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

    // İlan metninde geçen Panoramik cam tavan, Matrix LED ve 360 Çevre Görüş kamerası,
    // açıklamada 'HASAR KAYDI : YOKTUR' yazmasına rağmen doğru şekilde 'true' olmalı
    expect(exterior.items.find((i) => i.id === "sunroof")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "ledMatrixHeadlights")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "camera360")!.present).toBe(true);
    expect(safety.items.find((i) => i.id === "laneAssist")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "seatHeating")!.present).toBe(true);
    expect(multimedia.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);
    // İlanda ve baz pakette belirtilmeyen opsiyonel donanımlar (Kör Nokta, Koltuk Soğutma) 'false' kalmalı
    expect(safety.items.find((i) => i.id === "blindSpot")!.present).toBe(false);
    expect(comfort.items.find((i) => i.id === "seatCooling")!.present).toBe(false);
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

    // AMG Performance paketi standartları (Kör nokta, 360 kamera, spor koltuk ısıtma, elektrikli bagaj, kokpit)
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
    // Koltuk soğutma opsiyoneldir, standart değildir
    expect(comfort.items.find((i) => i.id === "seatCooling")!.present).toBe(false);
  });

  it("verifies 2024 Audi Q3 35 TFSI Advanced package equipment (TR spec without driving assistance pack)", () => {
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

    // Audi Advanced standartları (Virtual Cockpit, LED, Dijital Klima, CarPlay)
    expect(comfort.items.find((i) => i.id === "digitalCockpit")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "digitalClimate")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "keylessGo")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "ledMatrixHeadlights")!.present).toBe(true);
    expect(multimedia.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);

    // TR pazarında Doğuş Otomotiv opsiyonları: İlanda açıkça yazmıyorsa Şerit Takip, Kör Nokta, Koltuk Soğutma YOKTUR
    expect(safety.items.find((i) => i.id === "laneAssist")!.present).toBe(false);
    expect(safety.items.find((i) => i.id === "blindSpot")!.present).toBe(false);
    expect(comfort.items.find((i) => i.id === "seatCooling")!.present).toBe(false);
    expect(exterior.items.find((i) => i.id === "camera360")!.present).toBe(false);
  });

  it("verifies 2021 BMW 118i Sport Line equipment (TR spec without driving assistance pack)", () => {
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

    // 2021 BMW 1 Serisi Sport Line: Dijital kokpit, LED, CarPlay, dijital klima standart
    expect(comfort.items.find((i) => i.id === "digitalCockpit")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "digitalClimate")!.present).toBe(true);
    expect(comfort.items.find((i) => i.id === "keylessGo")!.present).toBe(true);
    expect(exterior.items.find((i) => i.id === "ledMatrixHeadlights")!.present).toBe(true);
    expect(multimedia.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);

    // TR pazarında Borusan opsiyonları: İlanda açıkça yazmıyorsa Şerit Takip, Kör Nokta, 360 kamera, koltuk soğutma, elektrikli bagaj YOKTUR
    expect(safety.items.find((i) => i.id === "laneAssist")!.present).toBe(false);
    expect(safety.items.find((i) => i.id === "blindSpot")!.present).toBe(false);
    expect(exterior.items.find((i) => i.id === "camera360")!.present).toBe(false);
    expect(comfort.items.find((i) => i.id === "seatCooling")!.present).toBe(false);
    expect(exterior.items.find((i) => i.id === "electricTailgate")!.present).toBe(false);
  });

  it("distinguishes Dacia Duster Essential (base) vs Prestige/Journey (top)", () => {
    const dusterBase = evaluateCarEquipment({
      brand: "Dacia",
      model: "Duster",
      year: 2023,
      title: "Dacia Duster 1.0 Tce Essential 2023",
    });
    const dusterTop = evaluateCarEquipment({
      brand: "Dacia",
      model: "Duster",
      year: 2023,
      title: "Dacia Duster 1.3 Tce 150 hp Prestige Plus 2023",
    });

    const baseMul = dusterBase.find((c) => c.id === "multimedia")!;
    const topMul = dusterTop.find((c) => c.id === "multimedia")!;
    const topExt = dusterTop.find((c) => c.id === "exterior")!;
    const topSaf = dusterTop.find((c) => c.id === "safety")!;

    expect(baseMul.items.find((i) => i.id === "touchScreen")!.present).toBe(false);
    expect(topMul.items.find((i) => i.id === "touchScreen")!.present).toBe(true);
    expect(topMul.items.find((i) => i.id === "carplayAndroidAuto")!.present).toBe(true);
    expect(topExt.items.find((i) => i.id === "rearCamera")!.present).toBe(true);
    expect(topSaf.items.find((i) => i.id === "blindSpot")!.present).toBe(true);
  });

  it("distinguishes Nissan Qashqai Visia (base) vs Platinum (top)", () => {
    const qashqaiVisia = evaluateCarEquipment({
      brand: "Nissan",
      model: "Qashqai",
      year: 2022,
      title: "Nissan Qashqai 1.3 DIG-T Visia 2022",
    });
    const qashqaiPlat = evaluateCarEquipment({
      brand: "Nissan",
      model: "Qashqai",
      year: 2022,
      title: "Nissan Qashqai 1.3 DIG-T Platinum Premium 2022",
    });

    const visiaExt = qashqaiVisia.find((c) => c.id === "exterior")!;
    const platExt = qashqaiPlat.find((c) => c.id === "exterior")!;
    const platCom = qashqaiPlat.find((c) => c.id === "comfort")!;

    expect(visiaExt.items.find((i) => i.id === "camera360")!.present).toBe(false);
    expect(visiaExt.items.find((i) => i.id === "sunroof")!.present).toBe(false);

    expect(platExt.items.find((i) => i.id === "camera360")!.present).toBe(true);
    expect(platExt.items.find((i) => i.id === "sunroof")!.present).toBe(true);
    expect(platCom.items.find((i) => i.id === "seatHeating")!.present).toBe(true);
  });

  it("distinguishes Seat Leon Reference (base) vs FR (top)", () => {
    const leonRef = evaluateCarEquipment({
      brand: "Seat",
      model: "Leon",
      year: 2021,
      title: "Seat Leon 1.0 TSI Reference 2021",
    });
    const leonFR = evaluateCarEquipment({
      brand: "Seat",
      model: "Leon",
      year: 2021,
      title: "Seat Leon 1.5 eTSI FR 2021",
    });

    const refCom = leonRef.find((c) => c.id === "comfort")!;
    const frCom = leonFR.find((c) => c.id === "comfort")!;
    const frExt = leonFR.find((c) => c.id === "exterior")!;

    expect(refCom.items.find((i) => i.id === "digitalCockpit")!.present).toBe(false);
    expect(frCom.items.find((i) => i.id === "digitalCockpit")!.present).toBe(true);
    expect(frCom.items.find((i) => i.id === "ambientLighting")!.present).toBe(true);
    expect(frExt.items.find((i) => i.id === "sunroof")!.present).toBe(true);
    expect(frExt.items.find((i) => i.id === "ledMatrixHeadlights")!.present).toBe(true);
  });
});
