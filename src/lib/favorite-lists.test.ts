import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { DEFAULT_LIST_ID, DEFAULT_LIST_NAME, MAX_LIST_NAME, normalizeListName, serializeFavoriteLists } from "./favorite-lists";

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
  it("varsayılan liste her zaman ilk sırada ve listesiz favorileri taşır", () => {
    const suv = new Types.ObjectId();
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    const listId = new Types.ObjectId();
    const result = serializeFavoriteLists([{ _id: listId, name: "SUV", carIds: [a] }], [a, b, suv]);
    expect(result[0]).toEqual({ id: DEFAULT_LIST_ID, name: DEFAULT_LIST_NAME, carIds: [b.toString(), suv.toString()], isDefault: true });
    expect(result[1]).toEqual({ id: listId.toString(), name: "SUV", carIds: [a.toString()], isDefault: false });
  });

  it("hiç favori yokken yalnızca boş varsayılan liste döner", () => {
    expect(serializeFavoriteLists(undefined, undefined)).toEqual([
      { id: DEFAULT_LIST_ID, name: DEFAULT_LIST_NAME, carIds: [], isDefault: true },
    ]);
  });

  it("eksik alanları boş döndürür", () => {
    const listId = new Types.ObjectId();
    expect(serializeFavoriteLists([{ _id: listId }], [])[1]).toEqual({ id: listId.toString(), name: "", carIds: [], isDefault: false });
  });
});
