import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/auth";
import { revalidateListing } from "@/lib/revalidate-listing";
import { computeListingFair } from "@/lib/market-fair";
import { logAudit } from "@/lib/audit-log";
import { createNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await connectDB();
    // User modelinin Mongoose'a kayıtlı olduğundan emin ol
    void User;

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const filterType = url.searchParams.get("filter") || "all";

    const [userCount, pendingCount, rejectedCount, totalActive] = await Promise.all([
      Car.countDocuments({ sourceSite: "user" }),
      Car.countDocuments({ sourceSite: "user", moderationStatus: "pending" }),
      Car.countDocuments({ sourceSite: "user", moderationStatus: "rejected" }),
      Car.countDocuments({ status: "active" }),
    ]);

    let query: Record<string, unknown> = { status: "active" };
    let sort: Record<string, 1 | -1> = { updatedAt: -1 };

    if (filterType === "user") {
      query = { sourceSite: "user" };
      sort = { createdAt: -1 };
    } else if (filterType === "pending") {
      query = { sourceSite: "user", moderationStatus: "pending" };
      sort = { createdAt: -1 };
    } else if (filterType === "rejected") {
      query = { sourceSite: "user", moderationStatus: "rejected" };
      sort = { updatedAt: -1 };
    }

    const cars = await Car.find(query, {
      title: 1,
      price: 1,
      city: 1,
      sourceSite: 1,
      externalId: 1,
      status: 1,
      moderationStatus: 1,
      rejectionReason: 1,
      ownerId: 1,
      viewCount: 1,
      createdAt: 1,
      updatedAt: 1,
    })
      .populate("ownerId", "name email phone")
      .sort(sort)
      .limit(limit)
      .lean();

    return NextResponse.json({
      counts: {
        all: totalActive,
        user: userCount,
        pending: pendingCount,
        rejected: rejectedCount,
      },
      cars: cars.map((c: any) => ({
        ...c,
        _id: String(c._id),
        owner: c.ownerId
          ? {
              name: c.ownerId.name || "",
              email: c.ownerId.email || "",
              phone: c.ownerId.phone || "",
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error("GET /api/admin/listings error:", error);
    return NextResponse.json(
      { error: error?.message || "İlanlar alınamadı" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await request.json();
    const { carId, action, reason } = body || {};

    if (!carId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Geçersiz işlem parametresi." }, { status: 400 });
    }

    await connectDB();
    const car = await Car.findById(carId);
    if (!car) {
      return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
    }

    if (action === "approve") {
      car.moderationStatus = "approved";
      car.rejectionReason = "";
      car.status = "active";
    } else {
      car.moderationStatus = "rejected";
      car.rejectionReason = reason?.trim() || "Yönetici tarafından reddedildi.";
    }

    await car.save();
    revalidateListing(car._id);

    if (action === "approve") {
      // Arka planda adil değeri hesapla ki ilan açılışı 0ms olsun
      void computeListingFair(car._id).catch(() => {});
      await logAudit({
        action: "listing_approved",
        actor: admin.name,
        targetLabel: car.title,
        targetId: car._id.toString(),
      });
      if (car.ownerId) {
        await createNotification({
          userId: car.ownerId.toString(),
          type: "listing",
          title: "İlanın onaylandı ve yayında",
          body: car.title,
          link: `/cars/${car._id.toString()}`,
        }).catch(() => {});
      }
    } else {
      await logAudit({
        action: "listing_rejected",
        actor: admin.name,
        targetLabel: car.title,
        targetId: car._id.toString(),
        reason: car.rejectionReason,
      });
      if (car.ownerId) {
        await createNotification({
          userId: car.ownerId.toString(),
          type: "listing",
          title: "İlanın reddedildi",
          body: `${car.title}: ${car.rejectionReason}`,
          link: `/listings`,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, status: car.moderationStatus });
  } catch (error: any) {
    console.error("POST /api/admin/listings error:", error);
    return NextResponse.json(
      { error: error?.message || "İşlem kaydedilemedi" },
      { status: 500 }
    );
  }
}
