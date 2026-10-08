import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { MAX_FAVORITES, normalizeListName, serializeFavoriteLists } from "@/lib/favorite-lists";

const noStore = { "Cache-Control": "private, no-store" };

type UserLists = {
  favorites?: Types.ObjectId[];
  favoriteLists?: { _id: Types.ObjectId; name?: string; carIds?: Types.ObjectId[] }[];
} | null;

/**
 * PATCH /api/favorites/lists/:id  { name? , add? , remove? }
 *   name   → grubu yeniden adlandırır
 *   add    → ilanı gruba ekler (favorilerde değilse favoriler listesine de ekler)
 *   remove → ilanı yalnızca bu gruptan çıkarır (favorilerde kalır)
 * Yanıt: güncel grup listesi.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Geçersiz grup." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    await connectDB();
    const user = await User.findById(authUser.userId).select("favorites favoriteLists").lean<UserLists>();
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    const lists = user.favoriteLists || [];
    if (!lists.some((list) => list._id.toString() === id)) {
      return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });
    }
    const arrayFilters = [{ "l._id": new Types.ObjectId(id) }];

    if (body?.name !== undefined) {
      const name = normalizeListName(body.name);
      if (!name) return NextResponse.json({ error: "Grup adı boş olamaz." }, { status: 400 });
      const lower = name.toLocaleLowerCase("tr-TR");
      if (lists.some((list) => list._id.toString() !== id && String(list.name || "").toLocaleLowerCase("tr-TR") === lower)) {
        return NextResponse.json({ error: "Bu adda bir grubun zaten var." }, { status: 409 });
      }
      await User.updateOne({ _id: authUser.userId }, { $set: { "favoriteLists.$[l].name": name } }, { arrayFilters });
    }

    if (body?.add !== undefined) {
      const carId = body.add;
      if (typeof carId !== "string" || !Types.ObjectId.isValid(carId)) {
        return NextResponse.json({ error: "Geçerli bir ilan gerekli." }, { status: 400 });
      }
      if (!(await Car.exists({ _id: carId, ...PUBLIC_LISTING_FILTER }))) {
        return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
      }
      const alreadyFavorite = (user.favorites || []).some((fav) => fav.toString() === carId);
      if (!alreadyFavorite && (user.favorites || []).length >= MAX_FAVORITES) {
        return NextResponse.json({ error: `En fazla ${MAX_FAVORITES} ilan favorilenebilir.` }, { status: 400 });
      }
      await User.updateOne(
        { _id: authUser.userId },
        { $addToSet: { "favoriteLists.$[l].carIds": carId, favorites: carId } },
        { arrayFilters }
      );
    }

    if (body?.remove !== undefined) {
      const carId = body.remove;
      if (typeof carId !== "string" || !Types.ObjectId.isValid(carId)) {
        return NextResponse.json({ error: "Geçerli bir ilan gerekli." }, { status: 400 });
      }
      await User.updateOne({ _id: authUser.userId }, { $pull: { "favoriteLists.$[l].carIds": carId } }, { arrayFilters });
    }

    const fresh = await User.findById(authUser.userId).select("favoriteLists").lean<UserLists>();
    return NextResponse.json({ lists: serializeFavoriteLists(fresh?.favoriteLists) }, { headers: noStore });
  } catch (error) {
    console.error("PATCH /api/favorites/lists/[id] error:", error);
    return NextResponse.json({ error: "Grup güncellenemedi." }, { status: 500 });
  }
}

/** DELETE /api/favorites/lists/:id → grubu siler; içindeki ilanlar favorilerde kalır. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Geçersiz grup." }, { status: 400 });

    await connectDB();
    await User.updateOne({ _id: authUser.userId }, { $pull: { favoriteLists: { _id: new Types.ObjectId(id) } } });
    const fresh = await User.findById(authUser.userId).select("favoriteLists").lean<UserLists>();
    return NextResponse.json({ lists: serializeFavoriteLists(fresh?.favoriteLists) }, { headers: noStore });
  } catch (error) {
    console.error("DELETE /api/favorites/lists/[id] error:", error);
    return NextResponse.json({ error: "Grup silinemedi." }, { status: 500 });
  }
}
