import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { setDaemonControl, setDaemonMode, getDaemonControl } from "@/models/ScrapeMetric";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action; // "start" | "stop" | "set_mode"

    await connectDB();

    if (action === "set_mode") {
      const mode = body.mode;
      if (mode !== "hybrid" && mode !== "new_only" && mode !== "sweep_only") {
        return NextResponse.json({ error: "Geçersiz mod değeri" }, { status: 400 });
      }

      await setDaemonMode(mode);
      const status = await getDaemonControl();

      const modeLabels: Record<string, string> = {
        new_only: "🚀 Sadece Yeni İlan Keşfi Modu",
        sweep_only: "🧹 Sadece Ölü İlan Temizliği Modu",
        hybrid: "⚖️ Hibrit (Dengeli) Mod",
      };

      return NextResponse.json({
        success: true,
        command: status.command,
        status: status.status,
        mode: status.mode,
        message: `Çalışma modu güncellendi: ${modeLabels[mode] || mode}`,
      });
    }

    if (action !== "start" && action !== "stop" && action !== "restart") {
      return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
    }

    if (action === "restart") {
      await setDaemonControl("restart", "🔄 Yeniden Başlatılıyor (Taze Kod Çekiliyor)...");
      const status = await getDaemonControl();
      return NextResponse.json({
        success: true,
        command: status.command,
        status: status.status,
        mode: status.mode,
        message: "Otonom motor yeniden başlatılıyor ve en güncel kod GitHub'dan çekiliyor.",
      });
    }

    // Buton yalnızca daemon'a komut bırakır; taramayı daemon yapar. Eskiden burada
    // Vercel üzerinde "arka planda" doğrulama + tarama başlatılıyordu: yanıt
    // döndükten sonra sunucusuz fonksiyon kesilebildiği için yarım kalıyor ve
    // Arabam dahil tüm ilanları tarayıcı olmayan ortamda "doğruluyordu".
    if (action === "stop") {
      await setDaemonControl("stop", "🛑 Durduruldu (Panelden 'Motoru Başlat' ile çalıştırılabilir)");
    } else {
      await setDaemonControl("run", "🚀 Otonom Motor Devrede: Canlı Taranıyor...");
    }

    const status = await getDaemonControl();

    return NextResponse.json(
      {
        success: true,
        command: status.command,
        status: status.status,
        mode: status.mode,
        message: action === "stop" ? "Motor durduruldu." : "Motor başarıyla başlatıldı ve tarama devrede.",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error("Daemon control API hatası:", error);
    return NextResponse.json(
      { error: error?.message || "Sunucu hatası" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  }
}
