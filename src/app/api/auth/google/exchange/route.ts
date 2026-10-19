import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { authCookies, createSessionAndToken } from "@/lib/auth";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { consumeGoogleLoginTicket } from "@/lib/google-ticket";

const INVALID_TICKET = "Giriş bağlantısı geçersiz ya da süresi dolmuş. Google ile girişi yeniden dene.";

/**
 * Mobil uygulama, Google dönüşünde aldığı tek kullanımlık bileti buraya verir.
 * Yanıt, giriş uçlarıyla aynı biçimde oturum çerezini (Set-Cookie) taşır; uygulama token'ı oradan alır.
 */
export async function POST(request: Request) {
  try {
    const limited = await checkSharedRateLimit(request, "google-exchange", { limit: 30 });
    if (limited) return limited;

    const { code } = await readJson(request, { flat: true });
    const userId = await consumeGoogleLoginTicket(String(code ?? ""));
    if (!userId) {
      return NextResponse.json({ error: INVALID_TICKET }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: INVALID_TICKET }, { status: 401 });
    }

    const token = await createSessionAndToken(
      {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || "user",
      },
      request
    );
    const response = NextResponse.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
      },
    });
    for (const cookie of authCookies(token)) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  } catch (error) {
    console.error("POST /api/auth/google/exchange error:", error);
    return NextResponse.json(
      { error: "Google ile giriş tamamlanamadı. Tekrar dene." },
      { status: 500 }
    );
  }
}
