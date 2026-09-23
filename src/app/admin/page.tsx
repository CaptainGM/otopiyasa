import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AdminDeleteCarButton } from "@/components/AdminDeleteCarButton";
import { BusinessApprovals } from "@/components/BusinessApprovals";
import { ReportQueue, PendingReport } from "@/components/ReportQueue";
import { AdminCommentsSection } from "@/components/AdminCommentsSection";
import { DaemonStatsPanel } from "@/components/DaemonStatsPanel";
import { ScrapePanel } from "@/components/ScrapePanel";
import { SourceBadge } from "@/components/SourceBadge";
import { OldestListingsPanel } from "@/components/OldestListingsPanel";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { formatPrice, getTurkeyDateStr } from "@/lib/utils";
import { AuditLog } from "@/models/AuditLog";
import { Car } from "@/models/Car";
import { Comment } from "@/models/Comment";
import { Report } from "@/models/Report";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { DaemonHeartbeat, HourlyScrapeStat } from "@/models/ScrapeMetric";
import { ManualScrapeLog } from "@/models/ManualScrapeLog";
import { ListingSource } from "@/types";
import { cached, CACHE_TTL } from "@/lib/cache";

export const metadata = { title: "Yönetim | OtoPiyasa" };
export const dynamic = "force-dynamic";

interface AdminUserRow {
  _id: { toString(): string };
  name: string;
  email: string;
  role?: string;
  favorites?: unknown[];
  createdAt?: Date;
}

interface AdminCarRow {
  _id: { toString(): string };
  title: string;
  price: number;
  city: string;
  sourceSite?: string;
  externalId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const AUDIT_LABEL: Record<string, string> = {
  listing_approved: "İlan onaylandı",
  listing_rejected: "İlan reddedildi",
  business_approved: "İşletme onaylandı",
  business_rejected: "İşletme reddedildi",
  report_reviewed: "Şikayet incelendi",
  report_dismissed: "Şikayet reddedildi",
  car_deleted: "İlan silindi",
  comment_deleted: "Yorum silindi",
  user_warned: "Kullanıcı uyarıldı",
  user_muted: "Kullanıcı susturuldu",
};

const AUDIT_TONE: Record<string, string> = {
  listing_approved: "text-emerald-300",
  business_approved: "text-emerald-300",
  report_reviewed: "text-emerald-300",
  listing_rejected: "text-rose-300",
  business_rejected: "text-rose-300",
  car_deleted: "text-rose-300",
  comment_deleted: "text-rose-300",
  user_muted: "text-rose-300",
  user_warned: "text-amber-300",
  report_dismissed: "text-slate-400",
};

function readScrapeLogTail(lineCount = 12): string[] {
  try {
    const logPath = path.join(process.cwd(), "logs", "scheduled-scrape.log");
    if (!existsSync(logPath)) return [];
    return readFileSync(logPath, "utf8").trim().split(/\r?\n/).slice(-lineCount);
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/login?next=/admin");
  }

  await connectDB();
  let carCount = 0;
  let demoCount = 0;
  let archivedCount = 0;
  let userCount = 0;
  let subCount = 0;
  let commentCount = 0;
  let pendingBusiness: any[] = [];
  let users: AdminUserRow[] = [];
  let cars: AdminCarRow[] = [];
  let openReports: any[] = [];
  let auditRows: any[] = [];
  let rawComments: any[] = [];
  let heartbeatDoc: any = null;
  let hourlyDocs: any[] = [];
  let manualScrapeDocs: any[] = [];

  try {
    const fetchPromise = Promise.all([
      cached("admin:carStats", CACHE_TTL.short, async () => {
        const [activeCount, removedCount, demoCount] = await Promise.all([
          Car.countDocuments({ status: "active" }),
          Car.countDocuments({ status: "removed" }),
          Car.countDocuments({ status: "active", sourceSite: "demo" }),
        ]);
        return [{ activeCount, removedCount, demoCount }];
      }).catch(() => [{ activeCount: 0, removedCount: 0, demoCount: 0 }]),
      User.estimatedDocumentCount().catch(() => 0),
      Subscription.estimatedDocumentCount().catch(() => 0),
      Comment.estimatedDocumentCount().catch(() => 0),
      User.find(
        { businessStatus: "pending" },
        { name: 1, email: 1, businessName: 1, businessPhone: 1, createdAt: 1 }
      )
        .sort({ updatedAt: -1 })
        .lean()
        .catch(() => []),
      User.find({}, { name: 1, email: 1, role: 1, favorites: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .catch(() => []),
      Car.find(
        { status: "active" },
        { title: 1, price: 1, city: 1, sourceSite: 1, externalId: 1, createdAt: 1, updatedAt: 1 }
      )
        .sort({ updatedAt: -1 })
        .limit(40)
        .lean()
        .catch(() => []),
      Report.find({ status: "open" })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate({ path: "car", model: Car, select: "title" })
        .populate({ path: "reporter", model: User, select: "name" })
        .populate({ path: "reportedUser", select: "name muteCount" })
        .lean()
        .catch(() => []),
      AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(30)
        .lean()
        .catch(() => []),
      Comment.find()
        .sort({ createdAt: -1 })
        .limit(30)
        .populate({ path: "car", model: Car, select: "title price imageUrl" })
        .populate({ path: "user", model: User, select: "name email" })
        .lean()
        .catch(() => []),
      DaemonHeartbeat.findOne({ daemonId: "primary-daemon" }).lean().catch(() => null),
      HourlyScrapeStat.find()
        .select("timestamp dateStr hourRange scanned inserted updated deleted bySource")
        .sort({ timestamp: -1 })
        .limit(48)
        .lean()
        .catch(() => []),
      ManualScrapeLog.find(
        {},
        {
          actor: 1,
          source: 1,
          label: 1,
          scanned: 1,
          inserted: 1,
          updated: 1,
          deleted: 1,
          durationSeconds: 1,
          status: 1,
          message: 1,
          createdAt: 1,
          sampleVehicles: { $slice: 10 },
        }
      )
        .sort({ createdAt: -1 })
        .limit(15)
        .lean()
        .catch(() => []),
    ]);

    const results = await fetchPromise;

    const carStats = (results[0] as any[])?.[0] || { activeCount: 0, demoCount: 0, removedCount: 0 };
    carCount = carStats.activeCount || 0;
    demoCount = carStats.demoCount || 0;
    archivedCount = carStats.removedCount || 0;
    userCount = results[1] as number;
    subCount = results[2] as number;
    commentCount = results[3] as number;
    pendingBusiness = results[4] as any[];
    users = results[5] as AdminUserRow[];
    cars = results[6] as AdminCarRow[];
    openReports = results[7] as any[];
    auditRows = results[8] as any[];
    rawComments = results[9] as any[];
    heartbeatDoc = results[10] as any;
    hourlyDocs = results[11] as any[];
    manualScrapeDocs = results[12] as any[];
  } catch (err) {
    console.error("AdminPage veri yükleme hatası:", err);
  }

  const heartbeat = heartbeatDoc as any;
  const todayStr = getTurkeyDateStr();

  let todayScanned = 0;
  let todayInserted = 0;
  let todayUpdated = 0;
  let todayDeleted = 0;

  for (const stat of (hourlyDocs || []) as any[]) {
    if (stat.dateStr === todayStr) {
      todayScanned += stat.scanned || 0;
      todayInserted += stat.inserted || 0;
      todayUpdated += stat.updated || 0;
      todayDeleted += stat.deleted || 0;
    }
  }

  const lastHeartbeat = heartbeat?.lastHeartbeat
    ? new Date(heartbeat.lastHeartbeat)
    : null;
  const isOnline =
    heartbeat?.status !== "stopped" && heartbeat?.command !== "stop";

  const rawPhase = heartbeat?.currentPhase || "";
  const initialPhase = isOnline
    ? (rawPhase && !rawPhase.includes("run-daemon") && !rawPhase.includes("Bağlantı Kesildi")
        ? rawPhase
        : "🚀 Otonom Motor Aktif & Taranıyor...")
    : "🛑 Durduruldu (Panelden 'Motoru Başlat' ile çalıştırılabilir)";

  const initialDaemon = {
    isOnline,
    host: heartbeat?.host || "Oracle Cloud Always Free (Frankfurt)",
    currentPhase: initialPhase,
    cycle: heartbeat?.cycle || 1,
    memoryMb: isOnline ? (heartbeat?.memoryMb || 45) : 0,
    uptimeSeconds: isOnline ? (heartbeat?.uptimeSeconds || 0) : 0,
    lastHeartbeat: heartbeat?.lastHeartbeat ? new Date(heartbeat.lastHeartbeat).toISOString() : new Date().toISOString(),
    status: (isOnline ? (heartbeat?.status || "online") : "stopped") as any,
  };

  const initialToday = {
    date: todayStr,
    scanned: todayScanned,
    inserted: todayInserted,
    updated: todayUpdated,
    deleted: todayDeleted,
  };

  const initialHourly = (hourlyDocs || []).map((h: any) => ({
    _id: h._id.toString(),
    timestamp: h.timestamp ? new Date(h.timestamp).toISOString() : "",
    dateStr: h.dateStr || "",
    hourRange: h.hourRange || "",
    scanned: h.scanned || 0,
    inserted: h.inserted || 0,
    updated: h.updated || 0,
    deleted: h.deleted || 0,
    bySource: h.bySource || {},
    lastUpdated: h.lastUpdated ? new Date(h.lastUpdated).toISOString() : "",
  }));

  let manualTodayScanned = 0;
  let manualTodayInserted = 0;
  let manualTodayUpdated = 0;
  let manualTodayDuration = 0;
  let manualTodayOperations = 0;

  const initialManualLogs = (manualScrapeDocs || []).map((m: any) => {
    const mDateStr = m.createdAt ? getTurkeyDateStr(new Date(m.createdAt)) : "";
    if (mDateStr === todayStr) {
      manualTodayScanned += m.scanned || 0;
      manualTodayInserted += m.inserted || 0;
      manualTodayUpdated += m.updated || 0;
      manualTodayDuration += m.durationSeconds || 0;
      manualTodayOperations += 1;
    }

    const cleanSamples = Array.isArray(m.sampleVehicles)
      ? m.sampleVehicles.map((v: any) => ({
          _id: v._id ? String(v._id) : undefined,
          brand: String(v.brand || ""),
          model: String(v.model || ""),
          year: Number(v.year || 0),
          price: Number(v.price || 0),
          source: String(v.source || "arabam"),
          title: String(v.title || ""),
          imageUrl: String(v.imageUrl || ""),
          listingUrl: String(v.listingUrl || ""),
        }))
      : [];

    return {
      _id: String(m._id || ""),
      actor: String(m.actor || "Yönetici"),
      source: String(m.source || ""),
      label: String(m.label || ""),
      scanned: Number(m.scanned || 0),
      inserted: Number(m.inserted || 0),
      updated: Number(m.updated || 0),
      deleted: Number(m.deleted || 0),
      durationSeconds: Number(m.durationSeconds || 0),
      status: (m.status || "success") as any,
      message: String(m.message || ""),
      bySource: JSON.parse(JSON.stringify(m.bySource || {})),
      sampleVehicles: cleanSamples,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  const initialManualToday = {
    date: todayStr,
    scanned: manualTodayScanned,
    inserted: manualTodayInserted,
    updated: manualTodayUpdated,
    durationSeconds: Math.round(manualTodayDuration * 10) / 10,
    operations: manualTodayOperations,
  };


  const logLines = readScrapeLogTail();

  const stats = [
    { label: "Aktif İlan", value: carCount },
    { label: "Piyasa Arşivi", value: archivedCount, href: "/admin/archive", highlight: true },
    { label: "Kullanıcı", value: userCount },
    { label: "Abonelik", value: subCount },
    { label: "Yorum", value: commentCount, href: "#admin-comments" },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black">Yönetim Paneli</h1>
          <p className="mt-1 text-slate-400">
            Veri kaynakları, piyasa arşivi ve kullanıcıların tek ekrandan yönetimi.
          </p>
        </div>
        <Link
          href="/admin/archive"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2.5 text-sm font-bold text-amber-300 hover:bg-amber-500/25 transition"
        >
          <span>📦 Piyasa Arşivi (Kaldırılan İlanlar)</span>
          <span id="admin-badge-archive" className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-200">
            {archivedCount}
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((stat) => (
          stat.href ? (
            <a
              key={stat.label}
              href={stat.href}
              className="card p-4 hover:border-amber-500/50 transition block cursor-pointer group"
            >
              <p className="text-xs uppercase tracking-widest text-amber-400 font-bold group-hover:text-amber-300">
                {stat.label} →
              </p>
              <p
                id={stat.label === "Piyasa Arşivi" ? "admin-stat-archive" : undefined}
                className="mt-1 text-2xl font-black text-amber-300"
              >
                {stat.value}
              </p>
            </a>
          ) : (
            <div key={stat.label} className="card p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">{stat.label}</p>
              <p
                id={stat.label === "Aktif İlan" ? "admin-stat-active" : undefined}
                className="mt-1 text-2xl font-black"
              >
                {stat.value}
              </p>
            </div>
          )
        ))}
      </div>

      {/* 1. SIRADA: 7/24 OTONOM MOTOR & SAATLİK TAKİP */}
      <DaemonStatsPanel
        initialDaemon={initialDaemon}
        initialToday={initialToday}
        initialHourly={initialHourly}
      />

      {/* 2. SIRADA: MANUEL VERİ ÇEKME & DENETİM PANELİ */}
      <ScrapePanel
        initialLogs={initialManualLogs}
        initialToday={initialManualToday}
      />

      {/* 3. SIRADA: KULLANICI YORUMLARI MODERASYONU */}
      <AdminCommentsSection
        initialComments={rawComments.map((c: any) => ({
          _id: c._id.toString(),
          text: c.text,
          rating: c.rating,
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : "",
          car: c.car
            ? {
                _id: c.car._id?.toString(),
                title: c.car.title,
                price: c.car.price,
                imageUrl: c.car.imageUrl,
              }
            : null,
          user: c.user
            ? {
                _id: c.user._id?.toString(),
                name: c.user.name,
                email: c.user.email,
              }
            : null,
        }))}
      />

      <BusinessApprovals
        initial={pendingBusiness.map((u) => ({
          _id: u._id.toString(),
          name: u.name,
          email: u.email,
          businessName: u.businessName || "",
          businessPhone: u.businessPhone || "",
        }))}
      />

      <ReportQueue
        initial={openReports
          .filter((r) => !!r.car)
          .map(
            (r): PendingReport => ({
              _id: r._id.toString(),
              carId: r.car!._id.toString(),
              carTitle: r.car!.title || "(silinmiş ilan)",
              reason: r.reason,
              note: r.note,
              reporterName: r.reporter?.name || "Bilinmiyor",
              createdAt: r.createdAt?.toISOString?.() || "",
              chatSnapshot: r.chatSnapshot || null,
              reportedUserId: r.reportedUser?._id?.toString() || null,
              reportedUserName: r.reportedUser?.name || null,
              reportedUserMuteCount: r.reportedUser?.muteCount || 0,
            })
          )}
      />

      <div className="card p-5">
        <h2 className="mb-3 text-xl font-semibold">Gece scrape günlüğü</h2>
        {logLines.length === 0 ? (
          <p className="text-sm text-slate-500">
            Henüz log yok — zamanlanmış görev ilk kez 03:30&apos;da çalıştığında burada
            görünecek. Elle denemek için: <code>node scripts/scheduled-scrape.mjs</code>
          </p>
        ) : (
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs leading-relaxed text-slate-300">
            {logLines.join("\n")}
          </pre>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-xl font-semibold">Son aktiviteler</h2>
        {auditRows.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz kayıt yok.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {auditRows.map((row) => (
              <div
                key={row._id.toString()}
                className="flex flex-wrap items-baseline gap-x-2 border-b border-white/5 pb-2"
              >
                <span className={`font-semibold ${AUDIT_TONE[row.action] || ""}`}>
                  {AUDIT_LABEL[row.action] || row.action}
                </span>
                <span className="text-slate-300">{row.targetLabel}</span>
                {row.reason && <span className="text-xs text-slate-500">— {row.reason}</span>}
                <span className="ml-auto text-xs text-slate-600">
                  {row.actor} • {new Date(row.createdAt).toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-xl font-semibold">Kullanıcılar ({userCount})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="p-2.5">Ad</th>
                <th className="p-2.5">E-posta</th>
                <th className="p-2.5">Rol</th>
                <th className="p-2.5">Favori</th>
                <th className="p-2.5">Kayıt</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id.toString()} className="border-b border-white/5">
                  <td className="p-2.5 font-medium">{user.name}</td>
                  <td className="p-2.5 text-slate-400">{user.email}</td>
                  <td className="p-2.5">
                    {user.role === "admin" ? (
                      <span className="badge badge-accent">admin</span>
                    ) : (
                      <span className="badge">kullanıcı</span>
                    )}
                  </td>
                  <td className="p-2.5">{user.favorites?.length || 0}</td>
                  <td className="p-2.5 text-slate-500">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("tr-TR")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Son İşlem Gören İlanlar (50)</h2>
            <p className="text-xs text-slate-400">
              Scraper tarafından en son taranan, fiyatı veya detayları güncellenen canlı ilanlar.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="p-2.5">İlan</th>
                <th className="p-2.5">Kaynak</th>
                <th className="p-2.5">Fiyat</th>
                <th className="p-2.5">Şehir</th>
                <th className="p-2.5">Son Tarama / İşlem</th>
                <th className="p-2.5">İlk Kayıt</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car._id.toString()} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                  <td className="max-w-72 p-2.5">
                    <Link
                      href={`/cars/${car._id.toString()}`}
                      className="line-clamp-1 font-medium hover:text-amber-300"
                    >
                      {car.title}
                    </Link>
                    {car.externalId?.startsWith("demo-") && (
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        demo
                      </span>
                    )}
                  </td>
                  <td className="p-2.5">
                    <SourceBadge source={(car.sourceSite || "demo") as ListingSource} />
                  </td>
                  <td className="p-2.5 font-semibold">{formatPrice(car.price)}</td>
                  <td className="p-2.5 text-slate-400">{car.city}</td>
                  <td className="p-2.5 font-medium text-emerald-400">
                    {car.updatedAt
                      ? new Date(car.updatedAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>
                  <td className="p-2.5 text-slate-500 text-xs">
                    {car.createdAt
                      ? new Date(car.createdAt).toLocaleDateString("tr-TR")
                      : "-"}
                  </td>
                  <td className="p-2.5 text-right">
                    <AdminDeleteCarButton carId={car._id.toString()} title={car.title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* En Eski İlanlar Denetim Masası & Çoklu Kaynak Ölü İlan Avcısı */}
      <OldestListingsPanel />
    </div>
  );
}
