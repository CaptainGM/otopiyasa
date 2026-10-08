import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars } from "@/lib/serialize-car";
import { loadFavorites, loadMeta } from "@/lib/favorites";
import { MAX_FAVORITES, serializeFavoriteLists } from "@/lib/favorite-lists";
import { loadFavoriteState, placeCarInList, removeFavorites } from "@/lib/favorite-lists-server";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET /api/favorites            → herkese açık favori ilanlar (telefon/sahip gibi özel alanlar HİÇ gönderilmez),
 *                                 `unavailable`: satılmış/kaldırılmış favorilerin yalnızca başlık + küçük fotoğrafı,
 *                                 `lists`: varsayılan "Favori Listem" + kendi listeler, `meta`: not ve bildirim ayarları.
 * GET /api/favorites?ids=1      → yalnızca kimlikler + listeler + ayarlar (ilan sayfasındaki kalp düğmesi için hafif sorgu).
 */
export async function GET(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    await connectDB();

    if (new URL(request.url).searchParams.get("ids") === "1") {
      // Hafif sorgu: ilanlar yüklenmez; kalp durumu, "hangi listede" ve ayar bilgisi yeter.
      const state = await loadFavoriteState(authUser.userId);
      const ids = (state?.favorites || []).map((id) => id.toString());
      return NextResponse.json(
        {
          ids,
          lists: serializeFavoriteLists(state?.favoriteLists, state?.favorites),
          meta: await loadMeta(authUser.userId, ids),
        },
        { headers: noStore }
      );
    }

    const { lists, meta, available, unavailable } = await loadFavorites(authUser.userId);
    const marketMap = await getMarketMap(available.map((car) => ({ brand: car.brand, model: car.model, year: car.year })));
    // unavailable: yayından kalkmış/satılmış favoriler için yalnızca başlık+küçük fotoğraf (ayrıntı yok).
    return NextResponse.json(
      { favorites: attachMarketToCars(available, marketMap), unavailable, lists, meta },
      { headers: noStore }
    );
  } catch (error) {
    console.error("GET /api/favorites error:", error);
    return NextResponse.json({ error: "Favoriler alınamadı." }, { status: 500 });
  }
}

/** POST /api/favorites { carId, listId? } → ilanı favorilere ekler; listId verilirse o listeye, yoksa "Favori Listem"e koyar. */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const { carId, listId } = await request.json().catch(() => ({}));
    if (!carId || typeof carId !== "string" || !Types.ObjectId.isValid(carId)) {
      return NextResponse.json({ error: "Geçerli bir carId zorunludur." }, { status: 400 });
    }
    if (listId !== undefined && listId !== null && typeof listId !== "string") {
      return NextResponse.json({ error: "Geçersiz liste." }, { status: 400 });
    }

    await connectDB();
    // Yalnızca herkese açık ilan favorilenebilir; olmayan/gizli ilan kimliğiyle liste doldurulamaz.
    const exists = await Car.exists({ _id: carId, ...PUBLIC_LISTING_FILTER });
    if (!exists) {
      return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
    }

    const state = await loadFavoriteState(authUser.userId);
    if (!state) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }
    const already = (state.favorites || []).some((id) => id.toString() === carId);
    if (!already && (state.favorites || []).length >= MAX_FAVORITES) {
      return NextResponse.json({ error: `En fazla ${MAX_FAVORITES} ilan favorilenebilir.` }, { status: 400 });
    }
    if (listId && listId !== "default" && !(state.favoriteLists || []).some((list) => list._id.toString() === listId)) {
      return NextResponse.json({ error: "Liste bulunamadı." }, { status: 404 });
    }

    // $addToSet: aynı anda gelen iki istek ilanı iki kez eklemez.
    await placeCarInList(authUser.userId, carId, listId || null);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/favorites error:", error);
    return NextResponse.json({ error: "Favori eklenirken bir hata oluştu." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const { carId } = await request.json().catch(() => ({}));
    if (!carId || typeof carId !== "string" || !Types.ObjectId.isValid(carId)) {
      return NextResponse.json({ error: "Geçerli bir carId zorunludur." }, { status: 400 });
    }

    await connectDB();
    // Favoriden çıkan ilan listelerden ve ayarlarından (not, bildirim) da çıkar.
    await removeFavorites(authUser.userId, [carId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/favorites error:", error);
    return NextResponse.json({ error: "Favori kaldırılırken bir hata oluştu." }, { status: 500 });
  }
}
