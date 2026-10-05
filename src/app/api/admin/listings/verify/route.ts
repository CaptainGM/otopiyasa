import { revalidateListing } from "@/lib/revalidate-listing";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { verifySingleListing } from "@/lib/scraper/verify-listing";
import { archiveListings, markSeenAlive } from "@/lib/scraper/listing-lifecycle";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const { carId, action = "verify", autoArchive = true } = body;

    if (!carId) {
      return NextResponse.json({ error: "carId gerekli" }, { status: 400 });
    }

    await connectDB();

    const car = await Car.findById(carId);
    if (!car) {
      return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
    }

    // Manuel Arşive Kaldırma İşlemi
    if (action === "archive") {
      car.status = "removed";
      car.removedAt = new Date();
      car.removedReason = `manuel: ${admin.email || "yönetici"}`;
      await car.save();
      revalidateListing(car._id);
      return NextResponse.json({
        success: true,
        status: "gone",
        archived: true,
        message: "İlan başarıyla piyasa arşivine kaldırıldı.",
      });
    }

    const url = car.listingUrl;
    if (!url) {
      return NextResponse.json({
        success: false,
        status: "error",
        message: "İlanın kaynak bağlantı adresi (listingUrl) bulunamadı.",
      });
    }

    const checkResult = await verifySingleListing(car as any);

    let archived = false;
    if ((checkResult.status === "gone" || checkResult.status === "redirected") && autoArchive) {
      archived = (await archiveListings([car._id], `${car.sourceSite}: ${checkResult.reason}`)) > 0;
      revalidateListing(car._id);
    } else if (checkResult.status === "active") {
      // Canlı teyit updatedAt'i ("son değişiklik") oynatmaz.
      await markSeenAlive([car._id]);
    }

    return NextResponse.json({
      success: true,
      carId,
      ...checkResult,
      archived,
    });
  } catch (error: any) {
    console.error("Listing verify API error:", error);
    return NextResponse.json(
      { error: error?.message || "Sunucu hatası" },
      { status: 500 }
    );
  }
}
