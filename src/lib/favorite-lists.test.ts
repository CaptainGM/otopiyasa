import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { MAX_LIST_NAME, normalizeListName, serializeFavoriteLists } from "./favorite-lists";

describe("normalizeListName", () => {
  it("boşlukları sadeleştirir", () => {
    expect(normalizeListName("  Aile   arabası ")).toBe("Aile arabası");
  });

  it("boş ve geçersiz girdiyi reddeder", () => {
    expect(normalizeListName("   ")).toBeNull();
    expect(normalizeListName(undefined)).toBeNull();
    expect(normalizeListName(42)).toBeNull();
  });

  it("uzun adı keser", () => {
    expect(normalizeListName("a".repeat(100))).toHaveLength(MAX_LIST_NAME);
  });
});

describe("serializeFavoriteLists", () => {
  it("kimlikleri metne çevirir", () => {
    const listId = new Types.ObjectId();
    const carId = new Types.ObjectId();
    expect(serializeFavoriteLists([{ _id: listId, name: "SUV", carIds: [carId] }])).toEqual([
      { id: listId.toString(), name: "SUV", carIds: [carId.toString()] },
    ]);
  });

  it("eksik alanları boş döndürür", () => {
    expect(serializeFavoriteLists(undefined)).toEqual([]);
    const listId = new Types.ObjectId();
    expect(serializeFavoriteLists([{ _id: listId }])).toEqual([{ id: listId.toString(), name: "", carIds: [] }]);
  });
});
