import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { verifySingleListing } from "@/lib/scraper/verify-listing";

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
      car.updatedAt = new Date();
      await car.save();
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
      car.status = "removed";
      car.updatedAt = new Date();
      await car.save();
      archived = true;
    } else if (checkResult.status === "active") {
      car.updatedAt = new Date();
      await car.save();
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
