import { Car } from "@/models/Car";
import { COLORS } from "@/lib/derive-specs";
import { turkishSearchRegex } from "@/lib/utils";

export interface ColorOption {
  color: string;
  count: number;
}


export async function getColorOptions(): Promise<ColorOption[]> {
  const sums: Record<string, unknown> = {};
  COLORS.forEach((color, i) => {
    const regex = turkishSearchRegex(color);
    sums[`c${i}`] = {
      $sum: {
        $cond: [
          {
            $or: [
              { $regexMatch: { input: { $ifNull: ["$title", ""] }, regex, options: "i" } },
              { $regexMatch: { input: { $ifNull: ["$description", ""] }, regex, options: "i" } },
            ],
          },
          1,
          0,
        ],
      },
    };
  });

  const [row] = (await Car.aggregate([{ $group: { _id: null, ...sums } }])) as
    | Record<string, number>[]
    | [];
  if (!row) return [];

  return COLORS.map((color, i) => ({ color, count: row[`c${i}`] || 0 }))
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count || a.color.localeCompare(b.color, "tr"));
}
