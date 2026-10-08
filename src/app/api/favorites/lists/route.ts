import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { MAX_FAVORITES, MAX_FAVORITE_LISTS, normalizeListName, serializeFavoriteLists } from "@/lib/favorite-lists";

const noStore = { "Cache-Control": "private, no-store" };

type UserLists = {
  favorites?: Types.ObjectId[];
  favoriteLists?: { _id: Types.ObjectId; name?: string; carIds?: Types.ObjectId[] }[];
} | null;

/** GET /api/favorites/lists → kullanıcının favori grupları (yalnızca ad ve ilan kimlikleri). */
export async function GET() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    await connectDB();
    const user = await User.findById(authUser.userId).select("favoriteLists").lean<UserLists>();
    return NextResponse.json({ lists: serializeFavoriteLists(user?.favoriteLists) }, { headers: noStore });
  } catch (error) {
    console.error("GET /api/favorites/lists error:", error);
    return NextResponse.json({ error: "Gruplar alınamadı." }, { status: 500 });
  }
}

/** POST /api/favorites/lists  { name, carId? } → yeni grup; carId verilirse ilan hemen eklenir (ve favorilenir). */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const name = normalizeListName(body?.name);
    if (!name) return NextResponse.json({ error: "Grup adı boş olamaz." }, { status: 400 });

    const carId = body?.carId;
    if (carId !== undefined && (typeof carId !== "string" || !Types.ObjectId.isValid(carId))) {
      return NextResponse.json({ error: "Geçerli bir carId gerekli." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(authUser.userId).select("favorites favoriteLists").lean<UserLists>();
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    const existing = user.favoriteLists || [];
    if (existing.length >= MAX_FAVORITE_LISTS) {
      return NextResponse.json({ error: `En fazla ${MAX_FAVORITE_LISTS} grup açılabilir.` }, { status: 400 });
    }
    const lower = name.toLocaleLowerCase("tr-TR");
    if (existing.some((list) => String(list.name || "").toLocaleLowerCase("tr-TR") === lower)) {
      return NextResponse.json({ error: "Bu adda bir grubun zaten var." }, { status: 409 });
    }

    const carIds: string[] = [];
    if (carId) {
      if (!(await Car.exists({ _id: carId, ...PUBLIC_LISTING_FILTER }))) {
        return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
      }
      const alreadyFavorite = (user.favorites || []).some((id) => id.toString() === carId);
      if (!alreadyFavorite && (user.favorites || []).length >= MAX_FAVORITES) {
        return NextResponse.json({ error: `En fazla ${MAX_FAVORITES} ilan favorilenebilir.` }, { status: 400 });
      }
      carIds.push(carId);
    }

    // Üst sınır filtrede de var: aynı anda gelen iki istek 20'yi aşamaz.
    const update: Record<string, unknown> = { $push: { favoriteLists: { name, carIds } } };
    if (carId) update.$addToSet = { favorites: carId };
    const result = await User.updateOne(
      { _id: authUser.userId, [`favoriteLists.${MAX_FAVORITE_LISTS - 1}`]: { $exists: false } },
      update
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: `En fazla ${MAX_FAVORITE_LISTS} grup açılabilir.` }, { status: 400 });
    }

    const fresh = await User.findById(authUser.userId).select("favoriteLists").lean<UserLists>();
    return NextResponse.json({ lists: serializeFavoriteLists(fresh?.favoriteLists) }, { headers: noStore });
  } catch (error) {
    console.error("POST /api/favorites/lists error:", error);
    return NextResponse.json({ error: "Grup oluşturulamadı." }, { status: 500 });
  }
}
