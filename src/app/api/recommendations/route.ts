import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getRecommendationsForUser } from "@/lib/recommendations";

export async function GET() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    await connectDB();
    const recommendations = await getRecommendationsForUser(authUser.userId);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("GET /api/recommendations error:", error);
    return NextResponse.json(
      { error: "Öneriler yüklenirken hata oluştu." },
      { status: 500 }
    );
  }
}
