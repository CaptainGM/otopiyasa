import { Car } from "@/models/Car";
import { COLORS } from "@/lib/derive-specs";
import { turkishSearchRegex } from "@/lib/utils";
import { connectDB } from "@/lib/mongodb";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

export interface ColorOption {
  color: string;
  count: number;
}

export async function getColorOptions(): Promise<ColorOption[]> {
  await connectDB();
  const rows = await Car.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        ...PUBLIC_LISTING_FILTER,
        "features.color": { $exists: true, $nin: ["", "Bilinmiyor", "Diğer", "null", "undefined"] },
      },
    },
    { $group: { _id: "$features.color", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 30 },
  ]);

  return rows
    .filter((r) => r._id && typeof r._id === "string" && r.count > 0)
    .map((r) => ({ color: r._id.trim(), count: r.count }));
}
