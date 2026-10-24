import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { VisitorLog } from "@/models/VisitorLog";
import { getFlagUrl } from "@/lib/geo-ip";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await connectDB();
    const url = new URL(request.url);

    // Belirli bir IP'nin detaylı gezinti geçmişi istendiyse:
    const targetIp = url.searchParams.get("ip");
    if (targetIp) {
      const logs = await VisitorLog.find({ ip: targetIp })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      return NextResponse.json({
        ip: targetIp,
        visits: logs,
        firstSeen: logs[logs.length - 1]?.createdAt || null,
        lastSeen: logs[0]?.createdAt || null,
        totalActions: logs.length,
      });
    }

    const range = url.searchParams.get("range") || "24h";

    let dateFilter: Record<string, unknown> = {};
    const now = Date.now();
    if (range === "24h") {
      dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
    } else if (range === "7d") {
      dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    } else if (range === "30d") {
      dateFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
    }

    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

    const [
      totalVisits,
      uniqueIpsList,
      onlineIpsList,
      userTypeAgg,
      countryAgg,
      deviceAgg,
      topPagesAgg,
      recent
    ] = await Promise.all([
      VisitorLog.countDocuments(dateFilter),
      VisitorLog.distinct("ip", dateFilter),
      VisitorLog.distinct("ip", { createdAt: { $gte: fiveMinutesAgo } }),
      VisitorLog.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              isRegistered: "$isRegistered",
              isBot: "$isBot",
            },
            count: { $sum: 1 },
          },
        },
      ]),
      VisitorLog.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$country",
            countryName: { $first: "$countryName" },
            flag: { $first: "$flag" },
            count: { $sum: 1 },
            uniqueIps: { $addToSet: "$ip" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      VisitorLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$device", count: { $sum: 1 } } },
      ]),
      VisitorLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$path", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      VisitorLog.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(80)
        .select("ip country countryName flag city path device browser os referrer isRegistered userEmail userName isBot botName createdAt")
        .lean(),
    ]);

    const total = totalVisits || 0;
    const countries = countryAgg.map((c) => ({
      country: c._id || "XX",
      countryName: c.countryName || c._id,
      flag: c.flag || "🌐",
      flagUrl: getFlagUrl(c._id || "XX"),
      count: c.count,
      uniqueIps: Array.isArray(c.uniqueIps) ? c.uniqueIps.length : 1,
      percentage: total > 0 ? Math.round((c.count / total) * 100) : 0,
    }));

    const deviceMap: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0, bot: 0 };
    for (const d of deviceAgg) {
      if (d._id && deviceMap[d._id] !== undefined) {
        deviceMap[d._id] = d.count;
      }
    }

    // Kullanıcı türü dağılımı (Kayıtlı üye / Misafir / Bot)
    let registeredCount = 0;
    let botCount = 0;
    let guestCount = 0;
    for (const item of userTypeAgg) {
      if (item._id?.isBot) {
        botCount += item.count;
      } else if (item._id?.isRegistered) {
        registeredCount += item.count;
      } else {
        guestCount += item.count;
      }
    }

    const topPages = topPagesAgg.map((p) => ({
      path: p._id || "/",
      count: p.count,
    }));

    return NextResponse.json(
      {
        totalVisits,
        uniqueIps: uniqueIpsList.length,
        onlineCount: onlineIpsList.length,
        countryCount: countries.length,
        userBreakdown: {
          registered: registeredCount,
          guest: guestCount,
          bot: botCount,
        },
        countries,
        deviceMap,
        topPages,
        recentVisitors: recent.map((r: any) => ({
          ...r,
          flagUrl: getFlagUrl(r.country || "XX"),
        })),
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Traffic API error:", error);
    return NextResponse.json({ error: "Trafik verileri alınamadı" }, { status: 500 });
  }
}
