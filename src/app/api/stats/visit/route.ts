import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { VisitorLog } from "@/models/VisitorLog";
import { extractClientIp, resolveGeo, parseUserAgent } from "@/lib/geo-ip";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Aynı IP'nin aynı sayfayı 15 saniye içinde defalarca kaydetmesini önleme (debouncing):
const recentVisits = new Map<string, number>();

function isRecentDuplicate(ip: string, path: string): boolean {
  const key = `${ip}:${path}`;
  const now = Date.now();
  const lastTime = recentVisits.get(key);
  if (lastTime && now - lastTime < 15_000) {
    return true;
  }
  recentVisits.set(key, now);
  // Bellek temizliği (2000 kaydı aşarsa eski kayıtları sil)
  if (recentVisits.size > 2000) {
    for (const [k, time] of recentVisits.entries()) {
      if (now - time > 60_000) recentVisits.delete(k);
    }
  }
  return false;
}

export async function POST(request: Request) {
  try {
    let body: { path?: string; referrer?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body boşsa devam et
    }

    const path = String(body.path || "/").trim();

    // Yönetim paneli, API veya dahili sayfaları ziyaretçi sayma
    if (
      path.startsWith("/admin") ||
      path.startsWith("/api") ||
      path.startsWith("/_next") ||
      path.includes(".") // statik dosya istekleri
    ) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Site sahibi / yönetici gezinirken kendi ziyaretlerini saymasın:
    const session = await getCurrentUser();
    if (session?.role === "admin") {
      return NextResponse.json({ ok: true, ignored: "admin" });
    }

    const ip = extractClientIp(request.headers);

    // Kısa aralıklı tekrarları atla
    if (isRecentDuplicate(ip, path)) {
      return NextResponse.json({ ok: true, ignored: "duplicate" });
    }

    const uaString = request.headers.get("user-agent") || "";
    const ua = parseUserAgent(uaString);

    const geo = await resolveGeo(ip, request.headers);

    await connectDB();
    await VisitorLog.create({
      ip,
      country: geo.country,
      countryName: geo.countryName,
      flag: geo.flag,
      city: geo.city,
      path: path.slice(0, 200),
      device: ua.device,
      browser: ua.browser,
      os: ua.os,
      referrer: String(body.referrer || "").slice(0, 300),
      userAgent: uaString.slice(0, 250),

      // Kullanıcı oturumu / Üye bilgisi:
      userId: session?.userId || undefined,
      userEmail: session?.email || "",
      userName: session?.name || "",
      isRegistered: Boolean(session?.userId),

      // Bot bilgisi:
      isBot: ua.isBot,
      botName: ua.botName,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Ziyaretçi kaydı hatası:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
