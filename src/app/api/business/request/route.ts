import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

/**
 * İşletme hesabı başvurusu. Kullanıcı firma bilgisiyle başvurur; durum "pending"
 * olur ve admin onayı beklenir. Onaylanınca ilanlarda "İşletme" rozeti çıkar.
 */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = checkRateLimit(request, "business-request", { limit: 5, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json();
    const businessName = String(body.businessName || "").trim();
    const businessPhone = String(body.businessPhone || "").trim();

    if (businessName.length < 2) {
      return NextResponse.json({ error: "Firma adı zorunludur." }, { status: 400 });
    }
    if (!/^[\d\s()+-]{7,20}$/.test(businessPhone)) {
      return NextResponse.json({ error: "Geçerli bir işletme telefonu girin." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(authUser.userId);
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    if (user.businessStatus === "approved") {
      return NextResponse.json({ error: "İşletme hesabın zaten onaylı." }, { status: 409 });
    }

    user.accountType = "business";
    user.businessName = businessName;
    user.businessPhone = businessPhone;
    user.businessStatus = "pending";
    user.businessRejectionReason = "";
    await user.save();

    return NextResponse.json({
      status: "pending",
      message: "İşletme başvurun alındı. Onaylandığında bilgilendirileceksin.",
    });
  } catch (error) {
    console.error("POST /api/business/request error:", error);
    return NextResponse.json({ error: "Başvuru gönderilemedi." }, { status: 500 });
  }
}
