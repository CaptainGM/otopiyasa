import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { DEFAULT_LIST_ID, MAX_FAVORITES, normalizeListName } from "@/lib/favorite-lists";
import { loadFavoriteState, loadSerializedLists, placeCarInList } from "@/lib/favorite-lists-server";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * PATCH /api/favorites/lists/:id  { name? , add? }
 *   name → listeyi yeniden adlandırır ("Favori Listem" adı değişmez)
 *   add  → ilanı bu listeye TAŞIR: öteki listelerden çıkar, favorilerde değilse favorilere de eklenir.
 *          id "default" ise ilan "Favori Listem"e taşınır.
 * Yanıt: güncel listeler.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const { id } = await context.params;
    const isDefault = id === DEFAULT_LIST_ID;
    if (!isDefault && !Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Geçersiz liste." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    await connectDB();
    const state = await loadFavoriteState(authUser.userId);
    if (!state) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    const lists = state.favoriteLists || [];
    if (!isDefault && !lists.some((list) => list._id.toString() === id)) {
      return NextResponse.json({ error: "Liste bulunamadı." }, { status: 404 });
    }

    if (body?.name !== undefined) {
      if (isDefault) return NextResponse.json({ error: "\"Favori Listem\" yeniden adlandırılamaz." }, { status: 400 });
      const name = normalizeListName(body.name);
      if (!name) return NextResponse.json({ error: "Liste adı boş olamaz." }, { status: 400 });
      const lower = name.toLocaleLowerCase("tr-TR");
      if (lower === "favori listem" || lists.some((list) => list._id.toString() !== id && String(list.name || "").toLocaleLowerCase("tr-TR") === lower)) {
        return NextResponse.json({ error: "Bu adda bir listen zaten var." }, { status: 409 });
      }
      await User.updateOne(
        { _id: authUser.userId },
        { $set: { "favoriteLists.$[l].name": name } },
        { arrayFilters: [{ "l._id": new Types.ObjectId(id) }] }
      );
    }

    if (body?.add !== undefined) {
      const carId = body.add;
      if (typeof carId !== "string" || !Types.ObjectId.isValid(carId)) {
        return NextResponse.json({ error: "Geçerli bir ilan gerekli." }, { status: 400 });
      }
      if (!(await Car.exists({ _id: carId, ...PUBLIC_LISTING_FILTER }))) {
        return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
      }
      const alreadyFavorite = (state.favorites || []).some((fav) => fav.toString() === carId);
      if (!alreadyFavorite && (state.favorites || []).length >= MAX_FAVORITES) {
        return NextResponse.json({ error: `En fazla ${MAX_FAVORITES} ilan favorilenebilir.` }, { status: 400 });
      }
      await placeCarInList(authUser.userId, carId, isDefault ? null : id);
    }

    return NextResponse.json({ lists: await loadSerializedLists(authUser.userId) }, { headers: noStore });
  } catch (error) {
    console.error("PATCH /api/favorites/lists/[id] error:", error);
    return NextResponse.json({ error: "Liste güncellenemedi." }, { status: 500 });
  }
}

/** DELETE /api/favorites/lists/:id → listeyi siler; içindeki ilanlar "Favori Listem"e döner (favorilerde kalır). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const { id } = await context.params;
    if (id === DEFAULT_LIST_ID) return NextResponse.json({ error: "\"Favori Listem\" silinemez." }, { status: 400 });
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Geçersiz liste." }, { status: 400 });

    await connectDB();
    await User.updateOne({ _id: authUser.userId }, { $pull: { favoriteLists: { _id: new Types.ObjectId(id) } } });
    return NextResponse.json({ lists: await loadSerializedLists(authUser.userId) }, { headers: noStore });
  } catch (error) {
    console.error("DELETE /api/favorites/lists/[id] error:", error);
    return NextResponse.json({ error: "Liste silinemedi." }, { status: 500 });
  }
}
