import { Car } from "@/models/Car";
import { connectDB } from "@/lib/mongodb";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { cached, CACHE_TTL } from "@/lib/cache";

export interface ColorOption {
  color: string;
  count: number;
}

export async function getColorOptions(): Promise<ColorOption[]> {
  return cached("filters:colorOptions", CACHE_TTL.long, async () => {
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
  });
}
