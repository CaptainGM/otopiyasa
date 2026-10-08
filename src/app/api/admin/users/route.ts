import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/auth";
import { escapeRegExp } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

/**
 * Kullanıcı listesi (mobil yönetim ekranı; web panelindeki tablonun karşılığı). Yalnızca yönetici. Parola özeti,
 * sıfırlama/doğrulama kodları gibi gizli alanlar sorguya HİÇ dahil edilmez. Rol bu uç noktadan değiştirilemez:
 * yöneticilik yalnızca veritabanına doğrudan yazılarak verilir (scripts/make-admin.mjs).
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 60);
  const page = Math.max(1, Math.min(10_000, Number(url.searchParams.get("page")) || 1));
  const filter = q
    ? { $or: [{ name: new RegExp(escapeRegExp(q), "i") }, { email: new RegExp(escapeRegExp(q), "i") }] }
    : {};

  try {
    await connectDB();
    const [users, total, admins] = await Promise.all([
      User.find(filter)
        .select("name email role emailVerified accountType businessName businessStatus createdAt favorites")
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<
          Array<{
            _id: { toString(): string };
            name: string;
            email: string;
            role?: string;
            emailVerified?: boolean;
            accountType?: string;
            businessName?: string;
            businessStatus?: string;
            createdAt?: Date;
            favorites?: unknown[];
          }>
        >(),
      User.countDocuments(filter),
      User.countDocuments({ role: "admin" }),
    ]);

    return NextResponse.json(
      {
        total,
        admins,
        page,
        pageSize: PAGE_SIZE,
        users: users.map((u) => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          role: u.role === "admin" ? "admin" : "user",
          emailVerified: !!u.emailVerified,
          business: u.accountType === "business" ? { name: u.businessName || "", status: u.businessStatus || "none" } : null,
          favorites: u.favorites?.length ?? 0,
          createdAt: u.createdAt ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Kullanıcılar alınamadı." }, { status: 500 });
  }
}
