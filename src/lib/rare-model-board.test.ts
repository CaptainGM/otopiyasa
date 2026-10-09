import { describe, expect, it } from "vitest";
import { buildRareBoard, pageOfBoard, type BoardRow } from "./rare-model-board";

describe("buildRareBoard", () => {
  const segments = [
    { brand: "Fiat", model: "Linea 1.3 M.Jet AC", count: 1 },
    { brand: "Fiat", model: "Linea 1.4 Fire Pop", count: 2 },
    { brand: "Fiat", model: "Egea 1.3", count: 500 },
    { brand: "Fiat", model: "Doblo 1.6", count: 4 },
    { brand: "Ford", model: "Escort 1.4 CL", count: 3 },
    { brand: "Opel", model: "Model", count: 1 },
  ];
  const catalog = [
    { brand: "Fiat", model: "Croma", sourceCount: 7 },
    { brand: "Fiat", model: "Linea", sourceCount: 300 },
    { brand: "Ford", model: "Escort", sourceCount: 12 },
  ];

  it("donanımları aile altında toplar ve en azdan çoğa sıralar", () => {
    const rows = buildRareBoard(segments, catalog);
    expect(rows.map((r) => `${r.brand} ${r.model}:${r.count}`)).toEqual([
      "Fiat Croma:0",
      "Fiat Linea:3",
      "Ford Escort:3",
      "Fiat Doblo:4",
    ]);
  });

  it("katalogdaki kaynak sayısını bilinen ve hiç ilanı olmayan modellere yazar", () => {
    const rows = buildRareBoard(segments, catalog);
    expect(rows.find((r) => r.model === "Croma")).toMatchObject({ count: 0, sourceCount: 7 });
    expect(rows.find((r) => r.model === "Linea")).toMatchObject({ count: 3, sourceCount: 300 });
    expect(rows.find((r) => r.model === "Doblo")?.sourceCount).toBeNull();
  });

  it("eşit sayıda, kaynakta daha çok ilanı olan (daha çok eksik) önce gelir", () => {
    const rows = buildRareBoard(segments, catalog);
    const linea = rows.findIndex((r) => r.model === "Linea");
    const escort = rows.findIndex((r) => r.model === "Escort");
    expect(linea).toBeLessThan(escort);
  });

  it("tavanı aşan aileleri ve anlamsız model adlarını almaz", () => {
    const rows = buildRareBoard(segments, catalog);
    expect(rows.some((r) => r.model === "Egea")).toBe(false);
    expect(rows.some((r) => r.brand === "Opel")).toBe(false);
  });
});

describe("pageOfBoard", () => {
  const rows: BoardRow[] = Array.from({ length: 40 }, (_, i) => ({ brand: "A", model: `M${i}`, count: i, sourceCount: null }));

  it("sayfa başına 15 satır verir", () => {
    const p = pageOfBoard(rows, 1);
    expect(p).toMatchObject({ page: 1, pages: 3, pageSize: 15, total: 40 });
    expect(p.rows).toHaveLength(15);
    expect(pageOfBoard(rows, 3).rows).toHaveLength(10);
  });

  it("geçersiz sayfa numarasını sınırlar", () => {
    expect(pageOfBoard(rows, 99).page).toBe(3);
    expect(pageOfBoard(rows, -4).page).toBe(1);
    expect(pageOfBoard(rows, Number.NaN).page).toBe(1);
  });

  it("boş listede tek boş sayfa verir", () => {
    expect(pageOfBoard([], 1)).toMatchObject({ page: 1, pages: 1, total: 0, rows: [] });
  });
});
