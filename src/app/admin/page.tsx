import { redirect } from "next/navigation";
import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AdminTabs, AdminTabPanel } from "@/components/AdminTabs";
import { VisitorTrafficPanel } from "@/components/VisitorTrafficPanel";
import { BusinessApprovals } from "@/components/BusinessApprovals";
import { ReportQueue } from "@/components/ReportQueue";
import { AdminCommentsSection } from "@/components/AdminCommentsSection";
import { AdminRequestsQueue } from "@/components/AdminRequestsQueue";
import { DaemonStatsPanel } from "@/components/DaemonStatsPanel";
import { DailySummaryPanel } from "@/components/DailySummaryPanel";
import { FeatureStatusPanel } from "@/components/FeatureStatusPanel";
import { RareModelBoard } from "@/components/RareModelBoard";
import { HomeWatcherPanel } from "@/components/HomeWatcherPanel";
import { SystemHealthCard } from "@/components/SystemHealthCard";
import { collectHealthSnapshot, evaluateHealth } from "@/lib/health-check";
import { UNVERIFIED_ARABAM_FILTER } from "@/lib/unverified-listings";
import { ScrapePanel } from "@/components/ScrapePanel";
import { OldestListingsPanel } from "@/components/OldestListingsPanel";
import { AdminUsersTable } from "@/components/AdminUsersTable";
import { AdminCarsTable } from "@/components/AdminCarsTable";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { AuditLog } from "@/models/AuditLog";
import { Car } from "@/models/Car";
import { Comment } from "@/models/Comment";
import { Report } from "@/models/Report";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { cached, CACHE_TTL } from "@/lib/cache";

export const metadata = { title: "Yönetim | OtoPiyasa" };
export const dynamic = "force-dynamic";

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
  request_updated: "Talep güncellendi",
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
  request_updated: "text-amber-300",
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

  // YALNIZCA İLK AÇILAN KISIM (Genel Sekmesi ve Sayaçlar) SUNUCUDA ÇEKİLİR.
  // Ağır kullanıcı, ilan ve log listeleri diğer sekmelere dağıtıldı ve arka planda sırayla hazırlanır.
  let carStats = { activeCount: 0, removedCount: 0, demoCount: 0 };
  let userCount = 0;
  let subCount = 0;
  let commentCount = 0;
  let unverifiedCount = 0;
  let openReportsCount = 0;
  let auditRows: any[] = [];

  try {
    const [statsResult, uCount, sCount, cCount, unvCount, repCount, audits] = await Promise.all([
      cached("admin:carStats", CACHE_TTL.medium, async () => {
        const [activeCount, removedCount, demoCount] = await Promise.all([
          Car.countDocuments({ status: "active" }),
          Car.countDocuments({ status: "removed" }),
          Car.countDocuments({ status: "active", sourceSite: "demo" }),
        ]);
        return { activeCount, removedCount, demoCount };
      }).catch(() => ({ activeCount: 0, removedCount: 0, demoCount: 0 })),
      User.estimatedDocumentCount().catch(() => 0),
      Subscription.estimatedDocumentCount().catch(() => 0),
      Comment.estimatedDocumentCount().catch(() => 0),
      cached("admin:unverifiedCount", CACHE_TTL.short, () => Car.countDocuments(UNVERIFIED_ARABAM_FILTER)).catch(() => 0),
      Report.countDocuments({ status: "open" }).catch(() => 0),
      AuditLog.find().sort({ createdAt: -1 }).limit(30).lean().catch(() => []),
    ]);

    carStats = statsResult || carStats;
    userCount = uCount;
    subCount = sCount;
    commentCount = cCount;
    unverifiedCount = unvCount;
    openReportsCount = repCount;
    auditRows = audits || [];
  } catch (err) {
    console.error("AdminPage özet veri yükleme hatası:", err);
  }

  const logLines = readScrapeLogTail();

  const stats = [
    { label: "Aktif İlan", value: carStats.activeCount },
    { label: "Piyasa Arşivi", value: carStats.removedCount, href: "/admin/archive", highlight: true },
    { label: "Kullanıcı", value: userCount },
    { label: "Abonelik", value: subCount },
    { label: "Yorum", value: commentCount, href: "#admin-comments" },
    { label: "Kontrol Edilmemiş", value: unverifiedCount, href: "/admin/unverified" },
  ];

  // Anlık sistem sağlığı (yalnızca okuma; 60 sn önbellekli)
  const healthAt = new Date();
  const healthIssues = await cached("admin:healthIssues", 60 * 1000, () => collectHealthSnapshot(healthAt).then(evaluateHealth)).catch(() => []);

  return (
    <div className="relative space-y-8 pb-10">
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
            {carStats.removedCount}
          </span>
        </Link>
      </div>

      <AdminTabs defaultTab="genel">
        <AdminTabPanel id="genel" label="Genel">
          {/* GÜNLÜK ÖZET: bekçi + otonom + manuel, kaynak bazında (tam genişlik) */}
          <DailySummaryPanel />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {stats.map((stat) =>
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
            )}
          </div>

          <SystemHealthCard issues={healthIssues} checkedAt={healthAt} />

          {/* Site özelliklerinin canlı durumu: Genel sekmesinde */}
          <FeatureStatusPanel fixedOpen />

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
                      {row.actor} • {new Date(row.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AdminTabPanel>

        <AdminTabPanel id="trafik" label="Canlı Trafik & Ziyaretçiler">
          <VisitorTrafficPanel />
        </AdminTabPanel>

        <AdminTabPanel id="motor" label="Motor & Tarama">
          {/* 1. SIRADA: 7/24 OTONOM MOTOR & SAATLİK TAKİP */}
          <DaemonStatsPanel />

          {/* 1b. EVDEKİ BİLGİSAYARDA ÇALIŞAN ARABAM BEKÇİSİ */}
          <HomeWatcherPanel />

          {/* 2. SIRADA: MANUEL VERİ ÇEKME & DENETİM PANELİ */}
          <ScrapePanel />

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

          {/* En Eski İlanlar Denetim Masası & Çoklu Kaynak Ölü İlan Avcısı */}
          <OldestListingsPanel />
        </AdminTabPanel>

        <AdminTabPanel id="mod" label="Kullanıcılar & Moderasyon">
          {/* KULLANICI YORUMLARI MODERASYONU */}
          <AdminCommentsSection />

          <BusinessApprovals />

          <AdminUsersTable initialCount={userCount} />
        </AdminTabPanel>

        <AdminTabPanel id="sikayet" label="Şikayetler" badge={openReportsCount}>
          <ReportQueue />

          <AdminRequestsQueue />
        </AdminTabPanel>

        <AdminTabPanel id="ilan" label="İlanlar">
          <AdminCarsTable />
        </AdminTabPanel>

        <AdminTabPanel id="modeller" label="Modeller">
          <RareModelBoard fixedOpen />
        </AdminTabPanel>
      </AdminTabs>
    </div>
  );
}
