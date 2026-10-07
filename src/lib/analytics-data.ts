import { buildBrandSummariesFromGroups } from "@/lib/brand-summaries";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { MARKET_LISTING_FILTER as PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { mergeCategoryStats, normalizeBodyType, normalizeTransmission, trustedFeatureFilter } from "@/lib/vehicle-attrs";

/** Analiz sayfasının verisi (web: app/analytics/page.tsx, mobil: /api/analytics/overview). */
/**
 * Vites, yakıt ve kasa tipi Arabam toplu çekiminde ilan BAŞLIĞINDAN tahmin ediliyordu (örn. başlıkta "otomatik"
 * yoksa "Manuel"). Her dağılım yalnızca o özelliği doğrulanmış ilanlarla hesaplanır (bkz. trustedFeatureFilter);
 * bekçi ilan ve liste sayfalarını gezdikçe örnek büyür.
 *
 * Doğrulanmış ilan oranı bunun altındayken dağılım gösterilmez: o zaman örnek çoğunlukla galeri sitelerinden
 * gelir ve piyasayı temsil etmez (otomatik oranı olduğundan çok yüksek çıkar).
 */
const MIN_TRUSTED_COVERAGE = 0.25;

export const getAnalyticsData = async () => {
    await connectDB();
    // 1. Marka özetleri: TÜM aktif ilanlardan (aynı fiyat süzgeciyle). Eskiden yalnızca en yeni 1.200 ilandan
    // hesaplanıyordu; grafik "veritabanındaki markaların tamamı" derken Volkswagen'i 1.240 yerine 197 ilan gösteriyordu.
    const brandGroups = await Car.aggregate<{ _id: { b: string; m: string }; count: number; priceSum: number }>([
      { $match: { ...PUBLIC_LISTING_FILTER, price: { $gte: 50_000, $lte: 40_000_000 } } },
      { $group: { _id: { b: "$brand", m: "$model" }, count: { $sum: 1 }, priceSum: { $sum: "$price" } } },
    ]);

    // 2. Çoklu analitik agregasyonlar
    const [
      trustedFuel,
      trustedTrans,
      trustedBody,
      byYearRaw,
      activeTotal,
      fuelRaw,
      transRaw,
      bracketRaw,
      bodyRaw,
      topBrandsRaw,
    ] = await Promise.all([
      Car.countDocuments({ $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("fuelType")] }),
      Car.countDocuments({ $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("transmission")] }),
      Car.countDocuments({ $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("bodyType")] }),
      // Temizlenmiş Yıl Eğrisi (1995'ten gelecek model yılına, aşırı trol/hatalı fiyatlar elenmiş)
      Car.aggregate([
        {
          $match: {
            ...PUBLIC_LISTING_FILTER,
            price: { $gte: 50_000, $lte: 40_000_000 },
            // Yeni model yılı ilanları yıl bitmeden gelir (Ekim'de 2027 model): üst sınır gelecek yıl.
            year: { $gte: 1995, $lte: new Date().getFullYear() + 1 },
          },
        },
        {
          $group: {
            _id: "$year",
            count: { $sum: 1 },
            avgPrice: { $avg: "$price" },
          },
        },
        { $match: { count: { $gte: 5 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", count: 1, avgPrice: { $round: ["$avgPrice", 0] } } },
      ]),

      // Yalnızca güncel ve aktif ilan sayısı (arşiv çöpleri hariç)
      Car.countDocuments(PUBLIC_LISTING_FILTER),

      // Yakıt Türü Dağılımı
      Car.aggregate([
        { $match: { $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("fuelType"), { "features.fuelType": { $exists: true, $nin: ["", "Bilinmiyor"] } }] } },
        { $group: { _id: "$features.fuelType", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Vites Türü Dağılımı
      Car.aggregate([
        { $match: { $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("transmission"), { "features.transmission": { $exists: true, $ne: "" } }] } },
        { $group: { _id: "$features.transmission", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
      ]),

      // Bütçe Segmentleri
      Car.aggregate([
        { $match: { ...PUBLIC_LISTING_FILTER, price: { $gte: 50_000, $lte: 100_000_000 } } },
        {
          $bucket: {
            groupBy: "$price",
            boundaries: [50_000, 500_000, 1_000_000, 2_000_000, 4_000_000, 100_000_000],
            default: "Diğer",
            output: { count: { $sum: 1 }, avgPrice: { $avg: "$price" } },
          },
        },
      ]),

      // Kasa Tipi Dağılımı
      Car.aggregate([
        { $match: { $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("bodyType"), { "features.bodyType": { $exists: true, $ne: "" } }] } },
        { $group: { _id: "$features.bodyType", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
      ]),

      // En Popüler 10 Marka
      Car.aggregate([
        { $match: { ...PUBLIC_LISTING_FILTER, price: { $gte: 50_000, $lte: 40_000_000 } } },
        { $group: { _id: "$brand", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const totalSample = byYearRaw.reduce((sum, r) => sum + (r.count || 0), 0);
    const weightedSum = byYearRaw.reduce((sum, r) => sum + (r.count || 0) * (r.avgPrice || 0), 0);
    const overallAvgPrice = totalSample > 0 ? Math.round(weightedSum / totalSample) : 0;

    const BRACKET_LABELS: Record<string, string> = {
      "50000": "0 - 500B ₺",
      "500000": "500B - 1M ₺",
      "1000000": "1M - 2M ₺",
      "2000000": "2M - 4M ₺",
      "4000000": "4M ₺+",
    };

    const totalBracketCount = bracketRaw.reduce((acc, b) => acc + (b.count || 0), 0) || 1;
    const priceBrackets = bracketRaw.map((b) => ({
      label: BRACKET_LABELS[String(b._id)] || "Diğer",
      count: b.count,
      avgPrice: Math.round(b.avgPrice || 0),
      sharePct: Math.round(((b.count || 0) / totalBracketCount) * 100),
    }));

    // Kaynakların farklı yazdığı değerler birleştirilir (Tiptronik → Otomatik, Suv/Arazi aracı → SUV...) ve
    // yüzdeler tüm bilinen ilanlara göre hesaplanır (bkz. lib/vehicle-attrs.ts).
    const base = (trusted: number) => ({
      trusted,
      total: activeTotal,
      minCoveragePct: Math.round(MIN_TRUSTED_COVERAGE * 100),
      gated: !(activeTotal > 0 && trusted / activeTotal >= MIN_TRUSTED_COVERAGE),
    });
    const featureBases = { fuelType: base(trustedFuel), transmission: base(trustedTrans), bodyType: base(trustedBody) };

    const totalFuelCount = fuelRaw.reduce((acc, f) => acc + (f.count || 0), 0) || 1;
    const fuelStats = (featureBases.fuelType.gated ? [] : fuelRaw).map((f) => ({
      fuel: f._id,
      count: f.count,
      avgPrice: Math.round(f.avgPrice || 0),
      sharePct: Math.round(((f.count || 0) / totalFuelCount) * 100),
    }));

    const transmissionStats = (!featureBases.transmission.gated ? mergeCategoryStats(transRaw, normalizeTransmission, 3) : []).map((t) => ({
      transmission: t.label,
      count: t.count,
      avgPrice: t.avgPrice,
      sharePct: t.sharePct,
    }));

    const bodyTypeStats = (!featureBases.bodyType.gated ? mergeCategoryStats(bodyRaw, normalizeBodyType, 5) : []).map((b) => ({
      bodyType: b.label,
      count: b.count,
      avgPrice: b.avgPrice,
      sharePct: b.sharePct,
    }));

    const topBrands = topBrandsRaw.map((b) => ({
      brand: b._id,
      count: b.count,
      avgPrice: Math.round(b.avgPrice || 0),
    }));

    return {
      brandSummaries: buildBrandSummariesFromGroups(
        brandGroups.map((g) => ({ brand: g._id.b, model: g._id.m, count: g.count, priceSum: g.priceSum }))
      ),
      byYear: byYearRaw,
      totalCars: activeTotal,
      overallAvgPrice,
      insights: {
        priceBrackets,
        fuelStats,
        transmissionStats,
        bodyTypeStats,
        topBrands,
        featureBases,
        generatedAt: new Date().toISOString(),
      },
    };
};
