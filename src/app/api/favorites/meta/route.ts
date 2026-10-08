import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { FavoriteMeta } from "@/models/FavoriteMeta";
import { DEFAULT_META, isDefaultMeta, mergeMetaInput, toMetaDTO } from "@/lib/favorite-meta";
import { loadFavoriteState } from "@/lib/favorite-lists-server";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * PUT /api/favorites/meta  { carId, note?, alertMode?, alertBelow?, alertEmail?, alertPush? }
 * Favori bir ilanın kişisel notunu ve fiyat bildirimi tercihini günceller (gönderilmeyen alanlar korunur).
 * Yalnızca kullanıcının favorilerindeki ilanlar için çalışır. Yanıt: güncel ayar.
 */
export async function PUT(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const carId = body?.carId;
    if (typeof carId !== "string" || !Types.ObjectId.isValid(carId)) {
      return NextResponse.json({ error: "Geçerli bir carId zorunludur." }, { status: 400 });
    }

    await connectDB();
    const state = await loadFavoriteState(authUser.userId);
    if (!(state?.favorites || []).some((id) => id.toString() === carId)) {
      return NextResponse.json({ error: "Önce ilanı favorilerine ekle." }, { status: 404 });
    }

    const existing = await FavoriteMeta.findOne({ userId: authUser.userId, carId }).lean();
    const merged = mergeMetaInput(existing ? toMetaDTO(existing as never) : { ...DEFAULT_META }, body);
    if ("error" in merged) return NextResponse.json({ error: merged.error }, { status: 400 });

    if (isDefaultMeta(merged.meta)) {
      await FavoriteMeta.deleteOne({ userId: authUser.userId, carId });
    } else {
      await FavoriteMeta.updateOne({ userId: authUser.userId, carId }, { $set: merged.meta }, { upsert: true });
    }
    return NextResponse.json({ meta: merged.meta }, { headers: noStore });
  } catch (error) {
    console.error("PUT /api/favorites/meta error:", error);
    return NextResponse.json({ error: "Ayar kaydedilemedi." }, { status: 500 });
  }
}
