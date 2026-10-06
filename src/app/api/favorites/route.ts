import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc, LIST_IMAGE_LIMIT } from "@/lib/serialize-car";

/** Bir kullanıcı en fazla bu kadar ilanı favorileyebilir (liste ve belge şişmesin). */
const MAX_FAVORITES = 500;

const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET /api/favorites            → herkese açık favori ilanlar (arşiv, satılmış ve onaysız ilanlar GİZLİ; telefon/sahip
 *                                 gibi özel alanlar HİÇ gönderilmez).
 * GET /api/favorites?ids=1      → yalnızca favori kimlikleri (ilan sayfasındaki kalp düğmesi için hafif sorgu).
 */
export async function GET(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(authUser.userId).select("favorites").lean<{ favorites?: Types.ObjectId[] } | null>();
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }
    const favoriteIds = (user.favorites || []).map((id) => id.toString());

    if (new URL(request.url).searchParams.get("ids") === "1") {
      return NextResponse.json({ ids: favoriteIds }, { headers: noStore });
    }

    const docs = favoriteIds.length
      ? (((await Car.find({ _id: { $in: favoriteIds }, ...PUBLIC_LISTING_FILTER })
          .slice("images", LIST_IMAGE_LIMIT)
          .lean()) as unknown[]).filter(isLeanCarDoc))
      : [];
    // Favori ekleme sırası korunur (en son eklenen başta).
    const rank = new Map(favoriteIds.map((id, index) => [id, index]));
    docs.sort((a, b) => (rank.get(b._id.toString()) ?? 0) - (rank.get(a._id.toString()) ?? 0));

    const marketMap = await getMarketMap(docs.map((car) => ({ brand: car.brand, model: car.model, year: car.year })));
    return NextResponse.json({ favorites: attachMarketToCars(docs, marketMap) }, { headers: noStore });
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
    await User.updateOne({ _id: authUser.userId }, { $pull: { favorites: carId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/favorites error:", error);
    return NextResponse.json({ error: "Favori kaldırılırken bir hata oluştu." }, { status: 500 });
  }
}
