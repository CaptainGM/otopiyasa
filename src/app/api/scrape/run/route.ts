import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import {
  runScrapeJob,
  runRareBrandScrape,
  runRareModelScrape,
  runSparseMarketSegmentScrape,
  runPriceRefresh,
  runAddressBackfill,
  arabamRefreshStatus,
} from "@/lib/scraper/run-scrape";
import { runEnrichArabamBatch } from "@/lib/scraper/enrich-arabam";
import { runRecentArabamScrape } from "@/lib/scraper/arabam-discovery";
import { requireAdmin } from "@/lib/auth";
import { ManualScrapeLog } from "@/models/ManualScrapeLog";

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const secret = process.env.SCRAPE_RUN_SECRET;
    const providedSecret = request.headers.get("x-scrape-secret");
    const secretOk = Boolean(secret) && providedSecret === secret;

    const actorHeader = request.headers.get("x-actor-label");
    const modeHeader = request.headers.get("x-scrape-mode");

    let actor = "Yönetici";
    if (secretOk) {
      actor = actorHeader || (modeHeader ? `Terminal (scrape.bat - Mod ${modeHeader})` : "Terminal (scrape.bat)");
    } else {
      const admin = await requireAdmin();
      if (!admin) {
        return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
      }
      const adminName = admin.email || admin.name || "Yönetici";
      actor = actorHeader || `${adminName} (Web)`;
    }

    let body: any = {};
    try {
      body = await readJson(request);
    } catch {
      // Body boş veya geçersiz JSON
    }

    const isVercel = Boolean(process.env.VERCEL);
    await connectDB();

    const recordLog = async (
      result: any,
      sourceKey: string,
      label: string,
      status: "success" | "partial" | "error" = "success"
    ) => {
      try {
        const durationSeconds = Math.round((Date.now() - startTime) / 100) / 10;
        const scannedCount =
          result.sources?.reduce((acc: number, s: any) => acc + (s.fetched || 0), 0) ||
          (result.inserted || 0) + (result.updated || 0) ||
          (typeof result.scanned === "number" ? result.scanned : 0);

        const bySourceMap: Record<string, { fetched: number; saved: number; inserted?: number; updated?: number }> = {};
        if (Array.isArray(result.sources)) {
          for (const s of result.sources) {
            bySourceMap[s.source] = {
              fetched: s.fetched || 0,
              saved: s.saved || 0,
              // Kaynak bazında yeni/güncellenen yalnızca bildiren taramalarda yazılır (günlük özet bunlara bakar).
              ...(typeof s.inserted === "number" ? { inserted: s.inserted } : {}),
              ...(typeof s.updated === "number" ? { updated: s.updated } : {}),
            };
          }
        }

        await ManualScrapeLog.create({
          actor,
          source: sourceKey,
          label,
          scanned: scannedCount,
          inserted: result.inserted || 0,
          updated: result.updated || 0,
          deleted: result.deleted || 0,
          durationSeconds,
          status: result.success ? status : "partial",
          message: result.message || "",
          bySource: bySourceMap,
          sampleVehicles: result.sampleVehicles || [],
        });
      } catch (err) {
        console.error("[ManualScrapeLog] Kayıt hatası:", err);
      }
    };

    // 0. Arabam Galeri & Detay Zenginleştirme
    if (body.mode === "enrich-arabam") {
      const limit =
        typeof body.limit === "number" && body.limit > 0
          ? Math.min(body.limit, isVercel ? 20 : 100)
          : (isVercel ? 15 : 25);
      const result = await runEnrichArabamBatch(limit);
      await recordLog(result, "arabam", "Arabam Galeri, Açıklama ve Hasar Zenginleştirmesi");
      return NextResponse.json(result);
    }

    // 1. Nadir Marka Güçlendirme
    if (body.mode === "rare") {
      if (isVercel) {
        return NextResponse.json({
          success: false,
          message: "Nadir marka taraması Vercel CPU kotasını korumak için 7/24 Frankfurt VPS üzerinden otomatik yürütülmektedir.",
        });
      }
      const threshold =
        typeof body.threshold === "number" && body.threshold > 0
          ? Math.min(body.threshold, 500)
          : 40;
      const perBrandPages =
        typeof body.perBrandPages === "number" && body.perBrandPages > 0
          ? Math.min(body.perBrandPages, 20)
          : 12;
      const result = await runRareBrandScrape(threshold, perBrandPages);
      await recordLog(result, "rare-brand", "Nadir Marka Derin Tarama");
      return NextResponse.json(result);
    }

    // 2. Fiyat Taraması
    if (body.mode === "price-refresh") {
      const limit =
        typeof body.limit === "number" && body.limit > 0
          ? Math.min(body.limit, isVercel ? 20 : 5000)
          : (isVercel ? 15 : 500);
      const result = await runPriceRefresh(limit, body.progressOffset, body.progressTotal);
      await recordLog(result, "price-refresh", "Fiyat Doğrulama & Senkron");
      return NextResponse.json(result);
    }

    // 3. Durum Kontrolü
    if (body.mode === "refresh-status") {
      const status = await arabamRefreshStatus();
      return NextResponse.json(status);
    }

    // 4. Adres Tamamlama
    if (body.mode === "address-backfill") {
      const limit =
        typeof body.limit === "number" && body.limit > 0
          ? Math.min(body.limit, 10000)
          : 2000;
      const result = await runAddressBackfill(limit);
      await recordLog(result, "address-backfill", "Adres & İlçe Tamamlama");
      return NextResponse.json(result);
    }

    // 5. Nadir Model Doldurma
    if (body.mode === "rare-model") {
      const threshold =
        typeof body.threshold === "number" && body.threshold > 0
          ? Math.min(body.threshold, 1000)
          : 100;
      const perModelPages =
        typeof body.perModelPages === "number" && body.perModelPages > 0
          ? Math.min(body.perModelPages, 20)
          : 2;
      const maxSegments =
        typeof body.maxSegments === "number" && body.maxSegments > 0
          ? Math.min(body.maxSegments, 500)
          : 120;
      const maxListings =
        typeof body.maxListings === "number" && body.maxListings > 0
          ? Math.min(body.maxListings, 5000)
          : 1500;
      const result = await runRareModelScrape(threshold, perModelPages, maxSegments, maxListings);
      await recordLog(result, "rare-model", "Nadir Model Doldurma");
      return NextResponse.json(result);
    }

    // 5a. En güncel ilanlar: sitemap'ten son N günde yayınlanan ilanları en yeniden başlayarak çeker.
    if (body.mode === "recent") {
      if (isVercel) {
        return NextResponse.json(
          { success: false, message: "Bu tarama ev bilgisayarındaki scrape.bat üzerinden çalıştırılır." },
          { status: 409 }
        );
      }
      const days =
        typeof body.days === "number" && body.days > 0 ? Math.min(Math.trunc(body.days), 30) : 3;
      const maxListings =
        typeof body.maxListings === "number" && body.maxListings > 0
          ? Math.min(Math.trunc(body.maxListings), 5000)
          : 600;
      const result = await runRecentArabamScrape(days, maxListings);
      await recordLog(result, "recent", `Son ${days} Gün İlanları`);
      return NextResponse.json(result);
    }

    // 5b. Aykırı değer temizliği sonrası üçten az örneği kalan yıl segmentleri.
    if (body.mode === "sparse-market-segments") {
      if (isVercel) {
        return NextResponse.json(
          { success: false, message: "Bu uzun Arabam taramasını ev bilgisayarındaki scrape.bat üzerinden çalıştırın." },
          { status: 409 }
        );
      }
      const maxSegments =
        typeof body.maxSegments === "number" && body.maxSegments > 0
          ? Math.min(Math.trunc(body.maxSegments), 500)
          : 100;
      const pagesPerYear =
        typeof body.pagesPerYear === "number" && body.pagesPerYear > 0
          ? Math.min(Math.trunc(body.pagesPerYear), 20)
          : 4;
      const maxListings =
        typeof body.maxListings === "number" && body.maxListings > 0
          ? Math.min(Math.trunc(body.maxListings), 2500)
          : 500;
      const result = await runSparseMarketSegmentScrape(maxSegments, pagesPerYear, maxListings);
      await recordLog(result, "sparse-market-segments", "Seyrek Marka/Model/Yıl Emsali");
      return NextResponse.json(result);
    }

    // 6. Normal Kaynak Taraması (8 Kaynak veya Tekil)
    const source = body.source as
      | "sahibinden"
      | "arabam"
      | "otomerkezi"
      | "vavacars"
      | "otoplus"
      | "carvak"
      | "otokoc"
      | "dod"
      | "ikinciyeni"
      | "all"
      | undefined;
    const query = typeof body.query === "string" ? body.query : "otomobil";
    const maxLimit = isVercel ? 15 : 10000;
    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? Math.min(body.limit, maxLimit)
        : (isVercel ? 12 : undefined);

    const result = await runScrapeJob({ source: source || "all", query, limit });

    const sourceName = source === "all" ? "8 Kurumsal Kaynak (Tümü)" : (source?.toUpperCase() || "Tümü");
    await recordLog(result, source || "all", `${sourceName} Yeni İlan Çekimi`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/scrape/run error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Scrape işlemi başarısız oldu.",
      },
      { status: 500 }
    );
  }
}
