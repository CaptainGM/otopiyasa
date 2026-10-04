export interface ColorOption {
  color: string;
  count: number;
}

const IGNORED_COLORS = new Set(["", "bilinmiyor", "diğer", "null", "undefined"]);

export function normalizeColor(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR")
    .replace(/(^|[\s(/-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

export function normalizeColorOptions(rows: Array<{ _id: string; count: number }>): ColorOption[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row._id || typeof row._id !== "string" || row.count <= 0) continue;
    const color = normalizeColor(row._id);
    if (IGNORED_COLORS.has(color.toLocaleLowerCase("tr-TR"))) continue;
    counts.set(color, (counts.get(color) ?? 0) + row.count);
  }

  return [...counts.entries()]
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => b.count - a.count || a.color.localeCompare(b.color, "tr"))
    .slice(0, 30);
}
