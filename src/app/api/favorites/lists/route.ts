import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { MAX_FAVORITES, MAX_FAVORITE_LISTS, normalizeListName } from "@/lib/favorite-lists";
import { loadFavoriteState, loadSerializedLists, placeCarInList } from "@/lib/favorite-lists-server";

const noStore = { "Cache-Control": "private, no-store" };

/** GET /api/favorites/lists → "Favori Listem" + kullanıcının kendi listeleri (yalnızca ad ve ilan kimlikleri). */
export async function GET() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    await connectDB();
    return NextResponse.json({ lists: await loadSerializedLists(authUser.userId) }, { headers: noStore });
  } catch (error) {
    console.error("GET /api/favorites/lists error:", error);
    return NextResponse.json({ error: "Listeler alınamadı." }, { status: 500 });
  }
}

/** POST /api/favorites/lists  { name, carId? } → yeni liste; carId verilirse ilan hemen o listeye konur (ve favorilenir). */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const name = normalizeListName(body?.name);
    if (!name) return NextResponse.json({ error: "Liste adı boş olamaz." }, { status: 400 });

    const carId = body?.carId;
    if (carId !== undefined && (typeof carId !== "string" || !Types.ObjectId.isValid(carId))) {
      return NextResponse.json({ error: "Geçerli bir carId gerekli." }, { status: 400 });
    }

    await connectDB();
    const state = await loadFavoriteState(authUser.userId);
    if (!state) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    const existing = state.favoriteLists || [];
    if (existing.length >= MAX_FAVORITE_LISTS) {
      return NextResponse.json({ error: `En fazla ${MAX_FAVORITE_LISTS} liste açılabilir.` }, { status: 400 });
    }
    const lower = name.toLocaleLowerCase("tr-TR");
    if (lower === "favori listem" || existing.some((list) => String(list.name || "").toLocaleLowerCase("tr-TR") === lower)) {
      return NextResponse.json({ error: "Bu adda bir listen zaten var." }, { status: 409 });
    }

    if (carId) {
      if (!(await Car.exists({ _id: carId, ...PUBLIC_LISTING_FILTER }))) {
        return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
      }
      const alreadyFavorite = (state.favorites || []).some((id) => id.toString() === carId);
      if (!alreadyFavorite && (state.favorites || []).length >= MAX_FAVORITES) {
        return NextResponse.json({ error: `En fazla ${MAX_FAVORITES} ilan favorilenebilir.` }, { status: 400 });
      }
    }

    // Üst sınır filtrede de var: aynı anda gelen iki istek 20'yi aşamaz.
    const listId = new Types.ObjectId();
    const result = await User.updateOne(
      { _id: authUser.userId, [`favoriteLists.${MAX_FAVORITE_LISTS - 1}`]: { $exists: false } },
      { $push: { favoriteLists: { _id: listId, name, carIds: [] } } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: `En fazla ${MAX_FAVORITE_LISTS} liste açılabilir.` }, { status: 400 });
    }
    if (carId) await placeCarInList(authUser.userId, carId, listId.toString());

    return NextResponse.json({ lists: await loadSerializedLists(authUser.userId), createdId: listId.toString() }, { headers: noStore });
  } catch (error) {
    console.error("POST /api/favorites/lists error:", error);
    return NextResponse.json({ error: "Liste oluşturulamadı." }, { status: 500 });
  }
}
