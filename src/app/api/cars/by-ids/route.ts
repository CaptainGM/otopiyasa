import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { isLeanCarDoc, serializeCar, LIST_IMAGE_LIMIT } from "@/lib/serialize-car";

/** Verilen ID listesini (sırayı koruyarak) hafif kart verisine çevirir — son bakılanlar şeridi için. */
export async function GET(request: Request) {
  try {
    await connectDB();
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json({ items: [] });
    }

    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const docs = ((await Car.find({ _id: { $in: ids } })
      .slice("images", LIST_IMAGE_LIMIT)
      .lean()) as unknown[]).filter(isLeanCarDoc);

    const serialized = docs.map((d) => serializeCar(d));
    const items = ids
      .map((id) => serialized.find((c) => c._id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/cars/by-ids error:", error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
