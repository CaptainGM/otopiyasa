import { describe, it, expect } from "vitest";
import { parseEquipmentGuessResponse, type EquipmentGuessCarInput } from "./gemini";

const REQUESTED: EquipmentGuessCarInput[] = [
  {
    carId: "car1",
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    title: "Toyota Corolla 1.6 Dream",
    items: [
      { id: "seatHeating", name: "Koltuk Isıtma" },
      { id: "sunroof", name: "Sunroof" },
    ],
  },
  {
    carId: "car2",
    brand: "Honda",
    model: "Civic",
    year: 2019,
    title: "Honda Civic 1.6 Eco",
    items: [{ id: "camera360", name: "360 Kamera" }],
  },
];

describe("parseEquipmentGuessResponse", () => {
  it("geçerli JSON'daki istenen anahtarları kabul eder", () => {
    const text = JSON.stringify({
      guesses: [
        { key: "car1:seatHeating", present: true },
        { key: "car1:sunroof", present: false },
        { key: "car2:camera360", present: true },
      ],
    });
    const result = parseEquipmentGuessResponse(text, REQUESTED);
    expect(result).toEqual([
      { carId: "car1", itemId: "seatHeating", present: true },
      { carId: "car1", itemId: "sunroof", present: false },
      { carId: "car2", itemId: "camera360", present: true },
    ]);
  });

  it("istenmeyen (uydurulmuş) anahtarları atar", () => {
    const text = JSON.stringify({
      guesses: [
        { key: "car1:seatHeating", present: true },
        { key: "car1:wirelessCharging", present: true }, // istenmedi
        { key: "car3:camera360", present: true }, // istenmedi carId
      ],
    });
    const result = parseEquipmentGuessResponse(text, REQUESTED);
    expect(result).toEqual([{ carId: "car1", itemId: "seatHeating", present: true }]);
  });

  it("bozuk JSON'da boş dizi döner, hata fırlatmaz", () => {
    expect(parseEquipmentGuessResponse("bu json değil", REQUESTED)).toEqual([]);
    expect(parseEquipmentGuessResponse("{}", REQUESTED)).toEqual([]);
    expect(parseEquipmentGuessResponse(JSON.stringify({ guesses: "hayır" }), REQUESTED)).toEqual([]);
  });

  it("present alanı boolean değilse o girişi atar, diğerlerini korur", () => {
    const text = JSON.stringify({
      guesses: [
        { key: "car1:seatHeating", present: "evet" }, // string, geçersiz
        { key: "car1:sunroof", present: true },
      ],
    });
    expect(parseEquipmentGuessResponse(text, REQUESTED)).toEqual([{ carId: "car1", itemId: "sunroof", present: true }]);
  });

  it("aynı anahtar iki kez gelirse yalnızca ilkini alır", () => {
    const text = JSON.stringify({
      guesses: [
        { key: "car1:seatHeating", present: true },
        { key: "car1:seatHeating", present: false },
      ],
    });
    expect(parseEquipmentGuessResponse(text, REQUESTED)).toEqual([{ carId: "car1", itemId: "seatHeating", present: true }]);
  });

  it("hiç istek yoksa her şeyi atar", () => {
    const text = JSON.stringify({ guesses: [{ key: "car1:seatHeating", present: true }] });
    expect(parseEquipmentGuessResponse(text, [])).toEqual([]);
  });
});
