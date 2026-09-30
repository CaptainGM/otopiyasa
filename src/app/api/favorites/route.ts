import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(authUser.userId).populate({
      path: "favorites",
      model: Car,
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ favorites: user.favorites });
  } catch (error) {
    console.error("GET /api/favorites error:", error);
    return NextResponse.json(
      { error: "Favoriler yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const { carId } = await request.json();
    if (!carId) {
      return NextResponse.json({ error: "carId zorunludur." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const exists = user.favorites.some(
      (id: { toString(): string }) => id.toString() === carId
    );
    if (!exists) {
      user.favorites.push(carId);
      await user.save();
    }

    return NextResponse.json({ success: true, favorites: user.favorites });
  } catch (error) {
    console.error("POST /api/favorites error:", error);
    return NextResponse.json(
      { error: "Favori eklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const { carId } = await request.json();
    if (!carId) {
      return NextResponse.json({ error: "carId zorunludur." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    user.favorites = user.favorites.filter(
      (id: { toString(): string }) => id.toString() !== carId
    );
    await user.save();

    return NextResponse.json({ success: true, favorites: user.favorites });
  } catch (error) {
    console.error("DELETE /api/favorites error:", error);
    return NextResponse.json(
      { error: "Favori kaldırılırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
