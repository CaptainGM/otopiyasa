import { describe, it, expect } from "vitest";
import { pickTrending } from "./trending";
import type { Car } from "@/types";

function car(id: string, viewCount?: number): Car {
  return {
    _id: id,
    title: id,
    brand: "Test",
    model: "Model",
    year: 2020,
    price: 100000,
    mileage: 10000,
    city: "İstanbul",
    description: "",
    imageUrl: "",
    features: { fuelType: "Benzin", transmission: "Manuel", bodyType: "Sedan", color: "Beyaz" },
    source: "test",
    sourceSite: "arabam",
    priceHistory: [],
    createdAt: "",
    updatedAt: "",
    viewCount,
  };
}

describe("pickTrending", () => {
  it("sıfır/eksik görüntülenmesi olanları eler", () => {
    const cars = [car("a", 0), car("b", undefined), car("c", 5)];
    expect(pickTrending(cars).map((c) => c._id)).toEqual(["c"]);
  });

  it("çoktan aza sıralar", () => {
    const cars = [car("a", 3), car("b", 10), car("c", 7)];
    expect(pickTrending(cars).map((c) => c._id)).toEqual(["b", "c", "a"]);
  });

  it("limit uygular", () => {
    const cars = [car("a", 1), car("b", 2), car("c", 3)];
    expect(pickTrending(cars, 2).map((c) => c._id)).toEqual(["c", "b"]);
  });
});
