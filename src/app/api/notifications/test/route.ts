import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { sendPushToUsers } from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function POST() {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json(
      { error: "Bildirim testi göndermek için giriş yapmalısınız." },
      { status: 401 }
    );
  }

  await connectDB();

  // 1. Veritabanına uygulama içi bildirim kaydet
  await createNotification({
    userId: authUser.userId,
    type: "system",
    title: "🔔 Bildirim Sistemi Test Edildi",
    body: "Tebrikler! OtoPiyasa anlık bildirim sisteminiz başarıyla yapılandırıldı ve aktif çalışıyor.",
    link: "/profile",
  });

  // 2. Varsa web push veya mobil FCM aboneliklerine de push gönder
  try {
    await sendPushToUsers([authUser.userId], {
      title: "🔔 OtoPiyasa Test Bildirimi",
      body: "Anlık bildirim altyapınız başarıyla çalışıyor!",
      url: "/profile",
    });
  } catch (err) {
    console.warn("Push bildirimi gönderilirken hata oluştu:", err);
  }

  return NextResponse.json({
    success: true,
    message: "Test bildirimi başarıyla oluşturuldu ve gönderildi.",
  });
}
