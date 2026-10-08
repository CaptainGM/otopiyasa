import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars } from "@/lib/serialize-car";
import { loadFavorites } from "@/lib/favorites";
import { MAX_FAVORITES, serializeFavoriteLists } from "@/lib/favorite-lists";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET /api/favorites            → herkese açık favori ilanlar (telefon/sahip gibi özel alanlar HİÇ gönderilmez) ve
 *                                 `unavailable`: satılmış/kaldırılmış favorilerin yalnızca başlık + küçük fotoğrafı.
 * GET /api/favorites?ids=1      → yalnızca favori kimlikleri (ilan sayfasındaki kalp düğmesi için hafif sorgu).
 */
export async function GET(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    await connectDB();
    if (new URL(request.url).searchParams.get("ids") === "1") {
      // Hafif sorgu: ilanlar yüklenmez; kalp durumu ve "hangi gruplarda" bilgisi yeter.
      const user = await User.findById(authUser.userId)
        .select("favorites favoriteLists")
        .lean<{ favorites?: Types.ObjectId[]; favoriteLists?: { _id: Types.ObjectId; name?: string; carIds?: Types.ObjectId[] }[] } | null>();
      return NextResponse.json(
        { ids: (user?.favorites || []).map((id) => id.toString()), lists: serializeFavoriteLists(user?.favoriteLists) },
        { headers: noStore }
      );
    }

    const { lists, available, unavailable } = await loadFavorites(authUser.userId);
    const marketMap = await getMarketMap(available.map((car) => ({ brand: car.brand, model: car.model, year: car.year })));
    // unavailable: yayından kalkmış/satılmış favoriler için yalnızca başlık+küçük fotoğraf (ayrıntı yok).
    return NextResponse.json({ favorites: attachMarketToCars(available, marketMap), unavailable, lists }, { headers: noStore });
  } catch (error) {
    console.error("GET /api/favorites error:", error);
    return NextResponse.json({ error: "Favoriler alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    // Yalnızca herkese açık ilan favorilenebilir; olmayan/gizli ilan kimliğiyle liste doldurulamaz.
    const exists = await Car.exists({ _id: carId, ...PUBLIC_LISTING_FILTER });
    if (!exists) {
      return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
    }

    const user = await User.findById(authUser.userId).select("favorites").lean<{ favorites?: Types.ObjectId[] } | null>();
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }
    const already = (user.favorites || []).some((id) => id.toString() === carId);
    if (!already && (user.favorites || []).length >= MAX_FAVORITES) {
      return NextResponse.json({ error: `En fazla ${MAX_FAVORITES} ilan favorilenebilir.` }, { status: 400 });
    }

    // $addToSet: aynı anda gelen iki istek ilanı iki kez eklemez.
    await User.updateOne({ _id: authUser.userId }, { $addToSet: { favorites: carId } });
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
    // Favoriden çıkan ilan tüm gruplardan da çıkar (grup üyeleri her zaman favorilerin alt kümesidir).
    await User.updateOne(
      { _id: authUser.userId },
      { $pull: { favorites: carId, "favoriteLists.$[].carIds": carId } }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/favorites error:", error);
    return NextResponse.json({ error: "Favori kaldırılırken bir hata oluştu." }, { status: 500 });
  }
}
