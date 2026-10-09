import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { UserAvatar } from "@/models/UserAvatar";
import { getCurrentUser } from "@/lib/auth";
import { checkKeyRateLimit, checkSharedRateLimit } from "@/lib/api-rate-limit";
import { avatarDescriptor, decodeImageDataUrl, parseAvatarPreset } from "@/lib/avatar";
import { normalizeAvatar } from "@/lib/avatar-upload";
import { moderateAvatarImage } from "@/lib/avatar-moderation";

/** Fotoğraf yükleme hakkı: yapay zekâ bütçesi gerçek özelliklerle ortak, kullanıcı başına günde sınırlı. */
const UPLOADS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Hazır avatar seç: { preset: "car.3" }. Varsa yüklenmiş fotoğraf silinir. */
export async function PUT(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    const limited = await checkSharedRateLimit(request, "avatar-preset", { limit: 30 });
    if (limited) return limited;

    const { preset } = await readJson(request, { flat: true });
    if (!parseAvatarPreset(preset)) return NextResponse.json({ error: "Geçersiz avatar." }, { status: 400 });

    await connectDB();
    const user = await User.findByIdAndUpdate(
      authUser.userId,
      { $set: { avatarType: "preset", avatarPreset: String(preset) }, $inc: { avatarVersion: 1 } },
      { new: true }
    ).select("avatarType avatarPreset avatarVersion");
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    await UserAvatar.deleteOne({ userId: authUser.userId });
    return NextResponse.json({ avatar: avatarDescriptor(user) });
  } catch (error) {
    console.error("PUT /api/auth/avatar error:", error);
    return NextResponse.json({ error: "Avatar kaydedilemedi." }, { status: 500 });
  }
}

/** Kendi fotoğrafını yükle: { image: "data:image/jpeg;base64,..." } (tarayıcı önce küçültür). Denetimden geçmezse kaydedilmez. */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    const limited = await checkSharedRateLimit(request, "avatar-upload-ip", { limit: 10 });
    if (limited) return limited;

    const { image } = await readJson(request, { flat: true });
    const decoded = decodeImageDataUrl(image);
    if (!decoded.ok) return NextResponse.json({ error: decoded.error }, { status: 400 });

    // Hak, denetimden önce ayrılır: reddedilen fotoğraflar da yapay zekâ bütçesi harcar.
    const dayLimited = await checkKeyRateLimit("avatar-upload", authUser.userId, { limit: UPLOADS_PER_DAY, windowMs: DAY_MS });
    if (dayLimited) {
      return NextResponse.json(
        { error: `Günde en fazla ${UPLOADS_PER_DAY} fotoğraf deneyebilirsin. Yarın tekrar dene ya da hazır avatarlardan seç.` },
        { status: 429 }
      );
    }

    let normalized: Buffer;
    try {
      normalized = await normalizeAvatar(decoded.image);
    } catch {
      return NextResponse.json({ error: "Fotoğraf okunamadı, başka bir dosya dene." }, { status: 400 });
    }

    const verdict = await moderateAvatarImage(normalized);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.reason, moderated: !verdict.unavailable }, { status: verdict.unavailable ? 503 : 422 });
    }

    await connectDB();
    const user = await User.findByIdAndUpdate(
      authUser.userId,
      { $set: { avatarType: "photo", avatarPreset: null }, $inc: { avatarVersion: 1 } },
      { new: true }
    ).select("avatarType avatarPreset avatarVersion");
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    await UserAvatar.updateOne(
      { userId: authUser.userId },
      { $set: { data: normalized, contentType: "image/jpeg", version: user.avatarVersion, moderatedAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ avatar: avatarDescriptor(user) });
  } catch (error) {
    console.error("POST /api/auth/avatar error:", error);
    return NextResponse.json({ error: "Fotoğraf kaydedilemedi." }, { status: 500 });
  }
}

/** Avatarı kaldırır (harf rozetine döner) ve yüklenmiş fotoğrafı siler. */
export async function DELETE() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    await connectDB();
    await User.updateOne({ _id: authUser.userId }, { $set: { avatarType: null, avatarPreset: null }, $inc: { avatarVersion: 1 } });
    await UserAvatar.deleteOne({ userId: authUser.userId });
    return NextResponse.json({ avatar: null });
  } catch (error) {
    console.error("DELETE /api/auth/avatar error:", error);
    return NextResponse.json({ error: "Avatar kaldırılamadı." }, { status: 500 });
  }
}
