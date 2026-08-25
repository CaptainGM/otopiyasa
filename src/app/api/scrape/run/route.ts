import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import {
  runScrapeJob,
  runRareBrandScrape,
  runRareModelScrape,
  runPriceRefresh,
  runAddressBackfill,
  arabamRefreshStatus,
} from "@/lib/scraper/run-scrape";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Zamanlanmış görev (Görev Zamanlayıcı) admin oturumu açamayacağı için
    // .env'deki SCRAPE_RUN_SECRET ile de tetiklenebilir; secret tanımsızsa
    // bu yol tamamen kapalıdır.
    const secret = process.env.SCRAPE_RUN_SECRET;
    const providedSecret = request.headers.get("x-scrape-secret");
    const secretOk = Boolean(secret) && providedSecret === secret;

    if (!secretOk) {
      const admin = await requireAdmin();
      if (!admin) {
        return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));

    // Nadir-marka güçlendirme modu: DB'de az/hiç ilanı olan markaları derin tarar.
    if (body.mode === "rare") {
      const threshold =
        typeof body.threshold === "number" && body.threshold > 0
          ? Math.min(body.threshold, 500)
          : 40;
      const perBrandPages =
        typeof body.perBrandPages === "number" && body.perBrandPages > 0
          ? Math.min(body.perBrandPages, 20)
          : 12;
      await connectDB();
      const result = await runRareBrandScrape(threshold, perBrandPages);
      return NextResponse.json(result);
    }

    // Nadir-MODEL modu: marka+model bazında az ilanı olan segmentleri doldurur
    // (fiyat modeli marka geneline düşmesin diye).
    // Fiyat taraması: var olan ilanları yeniden çekip fiyatı senkronlar.
    if (body.mode === "price-refresh") {
      const limit =
        typeof body.limit === "number" && body.limit > 0
          ? Math.min(body.limit, 5000)
          : 500;
      await connectDB();
      const result = await runPriceRefresh(limit);
      return NextResponse.json(result);
    }

    // Tam yenileme döngüsünün (scripts/scrape.mjs mod 10) ilerleme kontrolü:
    // kaç Arabam ilanında hâlâ parça bazlı hasar verisi eksik.
    if (body.mode === "refresh-status") {
      await connectDB();
      const status = await arabamRefreshStatus();
      return NextResponse.json(status);
    }

    // Adres tamamlama: `address` alanı boş olan eski ilanları yeniden çeker
    // (haritada ilçelerine düşebilsinler diye).
    if (body.mode === "address-backfill") {
      const limit =
        typeof body.limit === "number" && body.limit > 0
          ? Math.min(body.limit, 10000)
          : 2000;
      await connectDB();
      const result = await runAddressBackfill(limit);
      return NextResponse.json(result);
    }

    if (body.mode === "rare-model") {
      const threshold =
        typeof body.threshold === "number" && body.threshold > 0
          ? Math.min(body.threshold, 100)
          : 10;
      const perModelPages =
        typeof body.perModelPages === "number" && body.perModelPages > 0
          ? Math.min(body.perModelPages, 20)
          : 6;
      const maxSegments =
        typeof body.maxSegments === "number" && body.maxSegments > 0
          ? Math.min(body.maxSegments, 500)
          : 120;
      const maxListings =
        typeof body.maxListings === "number" && body.maxListings > 0
          ? Math.min(body.maxListings, 5000)
          : 1500;
      await connectDB();
      const result = await runRareModelScrape(threshold, perModelPages, maxSegments, maxListings);
      return NextResponse.json(result);
    }

    const source = body.source as
      | "sahibinden"
      | "arabam"
      | "otomerkezi"
      | "all"
      | undefined;
    const query = typeof body.query === "string" ? body.query : "otomobil";
    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? Math.min(body.limit, 10000)
        : undefined;

    await connectDB();
    const result = await runScrapeJob({ source: source || "all", query, limit });

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
