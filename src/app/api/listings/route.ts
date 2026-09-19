import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { validateListingFields } from "@/lib/listing-validation";
import { moderateNewListing } from "@/lib/listing-moderation";
import { validateMinOffer } from "@/lib/offers";
import { createNotification } from "@/lib/notify";
import { appBaseUrl } from "@/lib/app-url";
import { isMailerConfigured, sendListingRejectedEmail, sendListingPublishedEmail } from "@/lib/mailer";
import { logAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/** Kullanıcının kendi ilanları (moderasyon durumu dahil). */
export async function GET() {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  await connectDB();
  const items = await Car.find({ ownerId: authUser.userId })
    .sort({ createdAt: -1 })
    .select("title brand model year price mileage city imageUrl images moderationStatus rejectionReason status viewCount createdAt")
    .lean();

  return NextResponse.json({
    items: items.map((c) => ({ ...c, _id: (c._id as { toString(): string }).toString() })),
  });
}

/** Yeni ilan oluştur → moderasyon → yayınla ya da reddet (sebep e-postası). */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = checkRateLimit(request, "create-listing", { limit: 10, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json();
    const input = {
      brand: String(body.brand || "").trim(),
      model: String(body.model || "").trim(),
      year: Number(body.year),
      price: Number(body.price),
      mileage: Number(body.mileage),
      city: String(body.city || "").trim(),
      district: String(body.district || "").trim(),
      description: String(body.description || "").trim(),
      contactPhone: String(body.contactPhone || "").trim(),
      // Satıcının kabul ettiği en düşük teklif (boş = sistem varsayılanı).
      minOffer: Math.trunc(Number(body.minOffer) || 0),
      fuelType: String(body.fuelType || "Bilinmiyor").trim(),
      transmission: String(body.transmission || "Bilinmiyor").trim(),
      bodyType: String(body.bodyType || "Belirtilmemiş").trim(),
      color: String(body.color || "Belirtilmemiş").trim(),
      images: Array.isArray(body.images)
        ? body.images.filter((s: unknown) => typeof s === "string" && /^(https?:|data:image\/)/.test(s)).slice(0, 20)
        : [],
    };

    const fields = validateListingFields(input);
    if (!fields.valid) {
      return NextResponse.json({ error: fields.errors.join(" ") }, { status: 400 });
    }

    const minCheck = validateMinOffer(input.minOffer, input.price);
    if (!minCheck.valid) {
      return NextResponse.json({ error: minCheck.error }, { status: 400 });
    }

    await connectDB();

    const outcome = await moderateNewListing(input);

    const owner = await User.findById(authUser.userId).select("businessStatus businessName email name").lean<{
      businessStatus?: string; businessName?: string; email: string; name: string;
    }>();
    const businessName = owner?.businessStatus === "approved" ? owner.businessName || "" : "";

    const car = await Car.create({
      title: `${input.brand} ${input.model} ${input.year}`.trim(),
      brand: input.brand,
      model: input.model,
      year: input.year,
      price: input.price,
      mileage: input.mileage,
      city: input.city,
      // İlçe `address` alanına yazılır: harita yerleştirmesi bu alanı okuyor
      // (bkz. lib/district-coords.ts resolvePlacement) → üye ilanları da
      // il merkezine yığılmak yerine gerçek ilçesinde görünür.
      address: input.district ? `${input.district}, ${input.city}` : "",
      description: input.description,
      contactPhone: input.contactPhone,
      minOffer: input.minOffer,
      imageUrl: input.images[0] || "",
      images: input.images,
      features: {
        fuelType: input.fuelType,
        transmission: input.transmission,
        bodyType: input.bodyType,
        color: input.color,
      },
      source: "user",
      sourceSite: "user",
      // Benzersiz externalId: {sourceSite, externalId} benzersiz-sparse indeksi
      // var; boş bırakılırsa ikinci kullanıcı ilanı çakışır.
      externalId: `user-${randomUUID()}`,
      sellerType: businessName ? "İşletme" : "Sahibinden",
      businessName,
      ownerId: authUser.userId,
      moderationStatus: outcome.status,
      rejectionReason: outcome.status === "rejected" ? outcome.reason : "",
      priceHistory: [{ price: input.price }],
    });

    // Yayınlandıysa da haber ver — kullanıcı ilanın gerçekten yayına
    // girdiğini görmek istiyor (önceden yalnızca RED durumunda mail gidiyordu).
    if (outcome.status === "approved") {
      await logAudit({ action: "listing_approved", targetLabel: car.title });
      await createNotification({
        userId: authUser.userId,
        type: "listing",
        title: "İlanın yayınlandı",
        body: car.title,
        link: `/cars/${car._id.toString()}`,
      });
      if (owner?.email && isMailerConfigured()) {
        sendListingPublishedEmail(owner.email, {
          title: car.title,
          url: `${appBaseUrl()}/cars/${car._id.toString()}`,
        }).catch((e) => console.warn("sendListingPublishedEmail failed:", e));
      }
    }

    // Reddedildiyse kullanıcıyı bilgilendir (bildirim + e-posta)
    if (outcome.status === "rejected") {
      await logAudit({ action: "listing_rejected", targetLabel: car.title, reason: outcome.reason });
      await createNotification({
        userId: authUser.userId,
        type: "listing",
        title: "İlanın yayınlanamadı",
        body: outcome.reason,
        link: "/profile",
      });
      if (owner?.email && isMailerConfigured()) {
        sendListingRejectedEmail(owner.email, { title: car.title, reason: outcome.reason }).catch(
          (e) => console.warn("sendListingRejectedEmail failed:", e)
        );
      }
    }

    return NextResponse.json({
      id: car._id.toString(),
      status: outcome.status,
      reason: outcome.reason,
      message:
        outcome.status === "approved"
          ? "İlanın yayınlandı."
          : `İlanın yayınlanamadı: ${outcome.reason}`,
    });
  } catch (error) {
    console.error("POST /api/listings error:", error);
    return NextResponse.json({ error: "İlan oluşturulamadı." }, { status: 500 });
  }
}
