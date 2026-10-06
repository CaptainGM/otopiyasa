import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { HourlyScrapeStat } from "@/models/ScrapeMetric";
import { Car } from "@/models/Car";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const timestampStr = searchParams.get("timestamp");

    await connectDB();

    let stat: any = null;
    if (id) {
      stat = await HourlyScrapeStat.findById(id).lean();
    } else if (timestampStr) {
      stat = await HourlyScrapeStat.findOne({ timestamp: new Date(timestampStr) }).lean();
    }

    if (!stat) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }

    const start = new Date(stat.timestamp);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    // 1. Gerçek zamanlı veritabanı sayıları (senkronizasyon için)
    const [realRemovedCount, realNewCount, priceDocs, removedCars, newCars, detailDocs] = await Promise.all([
      // Arşive gidiş zamanı removedAt'tır; updatedAt başka nedenlerle de değişir.
      Car.countDocuments({ status: "removed", removedAt: { $gte: start, $lt: end } }),
      Car.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Car.find({
        "priceHistory.1": { $exists: true },
        priceHistory: {
          $elemMatch: {
            recordedAt: { $gte: start, $lt: end },
          },
        },
      })
        .sort({ updatedAt: -1 })
        .select("title brand model price priceHistory city imageUrl sourceSite listingUrl updatedAt")
        .limit(100)
        .lean(),

      // Bu saatte kaldırılan/arşivlenen araçlar (ilk 50)
      Car.find({ status: "removed", removedAt: { $gte: start, $lt: end } })
        .sort({ removedAt: -1 })
        .limit(50)
        .select("title brand model price city imageUrl sourceSite listingUrl updatedAt")
        .lean(),

      // Bu saatte eklenen yeni araçlar (ilk 50)
      Car.find({ createdAt: { $gte: start, $lt: end } })
        .sort({ createdAt: -1 })
        .limit(50)
        .select("title brand model price city imageUrl sourceSite listingUrl createdAt")
        .lean(),

      // Bu saatte açıklaması, kilometresi veya hasarı güncellenen araçlar (ilk 50)
      Car.find({
        "lastDetailChange.changedAt": { $gte: start, $lt: end },
      })
        .sort({ "lastDetailChange.changedAt": -1 })
        .limit(50)
        .select("title brand model price mileage city imageUrl sourceSite listingUrl lastDetailChange updatedAt")
        .lean(),
    ]);

    // Fiyatı gerçekten BU SAATTE değişen araçları filtrele (index >= 1)
    const priceChanged: any[] = [];
    for (const c of priceDocs as any[]) {
      const history = c.priceHistory || [];
      // Bu saat aralığındaki en güncel fiyat noktasını bul (index 0 hariç - 0 ilk oluşturma fiyatıdır)
      for (let i = history.length - 1; i >= 1; i--) {
        const pt = history[i];
        const t = new Date(pt.recordedAt).getTime();
        if (t >= start.getTime() && t < end.getTime()) {
          const previousPrice = history[i - 1]?.price ?? pt.price;
          const currentPrice = pt.price;
          const diff = currentPrice - previousPrice;
          priceChanged.push({
            _id: c._id.toString(),
            title: c.title,
            brand: c.brand,
            model: c.model,
            price: currentPrice,
            previousPrice,
            diff,
            city: c.city,
            imageUrl: c.imageUrl,
            sourceSite: c.sourceSite,
            listingUrl: c.listingUrl,
            updatedAt: pt.recordedAt || c.updatedAt,
          });
          break;
        }
      }
    }

    const realPriceChangedCount = priceChanged.length;

    const detailsChanged = (detailDocs as any[]).map((c) => ({
      _id: c._id.toString(),
      title: c.title,
      brand: c.brand,
      model: c.model,
      price: c.price,
      mileage: c.mileage,
      city: c.city,
      imageUrl: c.imageUrl,
      sourceSite: c.sourceSite,
      listingUrl: c.listingUrl,
      lastDetailChange: c.lastDetailChange,
      updatedAt: c.updatedAt,
    }));

    // Ağ teşhisi yalnızca motor ölçüp kaydettiyse gösterilir. Eskiden kayıt yoksa sayılardan tahmin edilip
    // "Tüm istekler başarılı (HTTP 200)" ya da "Cloudflare 429" diye UYDURMA bir sonuç yazılıyordu.
    const diagnostics = (stat as any).diagnostics || null;

    return NextResponse.json({
      success: true,
      stat,
      summary: {
        scanned: stat.scanned,
        inserted: stat.inserted,
        updated: stat.updated,
        deleted: stat.deleted,
        realRemovedCount: realRemovedCount > 0 ? realRemovedCount : (stat.deleted || 0),
        realNewCount: realNewCount > 0 ? realNewCount : (stat.inserted || 0),
        realPriceChangedCount,
        realDetailsChangedCount: detailsChanged.length,
      },
      diagnostics,
      removedCars,
      priceChanged,
      detailsChanged,
      newCars,
    });
  } catch (error: any) {
    console.error("Hourly detail API hatası:", error);
    return NextResponse.json(
      { error: error?.message || "Sunucu hatası" },
      { status: 500 }
    );
  }
}
