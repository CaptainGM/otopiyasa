import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { setDaemonControl, setDaemonMode, getDaemonControl } from "@/models/ScrapeMetric";
import { runScrapeJob } from "@/lib/scraper/run-scrape";

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

    if (action !== "start" && action !== "stop") {
      return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
    }

    if (action === "stop") {
      await setDaemonControl("stop", "🛑 Durduruldu (Panelden 'Motoru Başlat' ile çalıştırılabilir)");
    } else {
      await setDaemonControl("run", "🚀 Otonom Motor Devrede: Canlı Taranıyor...");
      // Telefondan veya panelden tıklandığında (bilgisayar kapalı olsa dahi) sunucuda doğrudan bulut taraması & ölü kontrolü tetikle
      void (async () => {
        try {
          const { sweepAndCleanDeadListings } = await import("@/lib/scraper/verify-listing");
          const { recordHourlyMetric } = await import("@/models/ScrapeMetric");

          // 1. Canlı ölü ilan kontrolü ve temizliği
          const sweepRes = await sweepAndCleanDeadListings({ limit: 30, concurrency: 2 });
          if (sweepRes.checked > 0) {
            await recordHourlyMetric({
              source: "other",
              scanned: sweepRes.checked,
              inserted: 0,
              updated: 0,
              deleted: sweepRes.archived,
            });
          }

          // 2. Çoklu kaynak canlı yeni araç çekimi
          const scrapeRes = await runScrapeJob({ source: "all", query: "", limit: 16 });
          if (Array.isArray(scrapeRes.sources)) {
            for (const s of scrapeRes.sources) {
              await recordHourlyMetric({
                source: s.source,
                scanned: s.fetched || 0,
                inserted: s.saved || 0,
                updated: 0,
                deleted: 0,
              });
            }
          }
        } catch (err) {
          console.error("[Daemon Control] Arka plan bulut tarama hatası:", err);
        }
      })();
    }

    const status = await getDaemonControl();

    return NextResponse.json({
      success: true,
      command: status.command,
      status: status.status,
      mode: status.mode,
      message: action === "stop" ? "Motor durduruldu." : "Motor başarıyla başlatıldı ve tarama devrede.",
    });
  } catch (error: any) {
    console.error("Daemon control API hatası:", error);
    return NextResponse.json(
      { error: error?.message || "Sunucu hatası" },
      { status: 500 }
    );
  }
}
