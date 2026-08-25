import { notFound } from "next/navigation";
import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AdminDeleteCarButton } from "@/components/AdminDeleteCarButton";
import { BusinessApprovals } from "@/components/BusinessApprovals";
import { ReportQueue, PendingReport } from "@/components/ReportQueue";
import { ScrapePanel } from "@/components/ScrapePanel";
import { SourceBadge } from "@/components/SourceBadge";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { formatPrice } from "@/lib/utils";
import { AuditLog } from "@/models/AuditLog";
import { Car } from "@/models/Car";
import { Comment } from "@/models/Comment";
import { Report } from "@/models/Report";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { ListingSource } from "@/types";

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
}

const AUDIT_LABEL: Record<string, string> = {
  listing_approved: "İlan onaylandı",
  listing_rejected: "İlan reddedildi",
  business_approved: "İşletme onaylandı",
  business_rejected: "İşletme reddedildi",
  report_reviewed: "Şikayet incelendi",
  report_dismissed: "Şikayet reddedildi",
  car_deleted: "İlan silindi",
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
  if (!admin) notFound();

  await connectDB();
  const [carCount, demoCount, userCount, subCount, commentCount, pendingBusiness, users, cars, openReports, auditRows] =
    await Promise.all([
      Car.countDocuments(),
      Car.countDocuments({ externalId: /^demo-/ }),
      User.countDocuments(),
      Subscription.countDocuments(),
      Comment.countDocuments(),
      User.find(
        { businessStatus: "pending" },
        { name: 1, email: 1, businessName: 1, businessPhone: 1, createdAt: 1 }
      )
        .sort({ updatedAt: -1 })
        .lean() as unknown as Promise<
        { _id: { toString(): string }; name: string; email: string; businessName?: string; businessPhone?: string }[]
      >,
      User.find({}, { name: 1, email: 1, role: 1, favorites: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean() as unknown as Promise<AdminUserRow[]>,
      Car.find(
        {},
        { title: 1, price: 1, city: 1, sourceSite: 1, externalId: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean() as unknown as Promise<AdminCarRow[]>,
      Report.find({ status: "open" })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate({ path: "car", model: Car, select: "title" })
        .populate({ path: "reporter", model: User, select: "name" })
        .populate({ path: "reportedUser", select: "name muteCount" })
        .lean() as unknown as Promise<
        {
          _id: { toString(): string };
          car?: { _id: { toString(): string }; title?: string } | null;
          reporter?: { name?: string } | null;
          reportedUser?: { _id: { toString(): string }; name?: string; muteCount?: number } | null;
          offer?: { toString(): string } | null;
          chatSnapshot?: string;
          reason: string;
          note: string;
          createdAt: Date;
        }[]
      >,
      AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(30)
        .lean() as unknown as Promise<
        { _id: { toString(): string }; action: string; actor: string; targetLabel: string; reason: string; createdAt: Date }[]
      >,
    ]);

  const logLines = readScrapeLogTail();

  const stats = [
    { label: "Toplam ilan", value: carCount },
    { label: "Gerçek / demo", value: `${carCount - demoCount} / ${demoCount}` },
    { label: "Kullanıcı", value: userCount },
    { label: "Abonelik", value: subCount },
    { label: "Yorum", value: commentCount },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-black">Yönetim Paneli</h1>
        <p className="mt-1 text-slate-400">
          Veri kaynakları, kullanıcılar ve ilanların tek ekrandan yönetimi.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-black">{stat.value}</p>
          </div>
        ))}
      </div>

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
        <h2 className="mb-4 text-xl font-semibold">Son ilanlar (50)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="p-2.5">İlan</th>
                <th className="p-2.5">Kaynak</th>
                <th className="p-2.5">Fiyat</th>
                <th className="p-2.5">Şehir</th>
                <th className="p-2.5">Eklenme</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car._id.toString()} className="border-b border-white/5">
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
                  <td className="p-2.5 text-slate-500">
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
    </div>
  );
}
