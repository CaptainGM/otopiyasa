import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { validateListingFields } from "@/lib/listing-validation";
import { moderateNewListing } from "@/lib/listing-moderation";
import { validateMinOffer } from "@/lib/offers";
import { logAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/** Bir ilanın sahibi mi? (yalnızca kendi kullanıcı ilanını düzenleyebilir/silebilir) */
async function ownedCar(id: string, userId: string) {
  // Geçersiz ObjectId CastError fırlatır (→ 500); önce eleyip 404 döndürüyoruz.
  if (!Types.ObjectId.isValid(id)) return null;
  const car = await Car.findById(id);
  if (!car || !car.ownerId || car.ownerId.toString() !== userId) return null;
  return car;
}

/** Kendi ilanını düzenle → yeniden moderasyon. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    // Düzenleme de moderasyon (dolayısıyla Gemini) tetikliyor → oluşturma ile
    // aynı şekilde sınırlanmalı; yoksa aynı ilan sürekli PATCH'lenerek kota yakılır.
    const limited = checkRateLimit(request, "edit-listing", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const { id } = await context.params;
    await connectDB();
    const car = await ownedCar(id, authUser.userId);
    if (!car) return NextResponse.json({ error: "İlan bulunamadı veya yetkiniz yok." }, { status: 404 });

    const body = await request.json();
    /**
     * Fotoğraflar moderasyona da GİRMELİ.
     *
     * Önceden `images` yalnızca kayda yazılıyor, `moderateNewListing`e
     * geçirilmiyordu; yani fotoğraf-marka uyum kontrolü (Gemini Vision)
     * düzenlemede hiç çalışmıyordu. Honda fotoğrafıyla Honda ilanı verip
     * onaylandıktan sonra markayı "Volkswagen" olarak düzenlemek denetimi
     * tamamen atlıyordu.
     */
    const images = Array.isArray(body.images)
      ? body.images
          .filter((s: unknown) => typeof s === "string" && /^(https?:|data:image\/)/.test(s))
          .slice(0, 20)
      : null;

    const input = {
      brand: String(body.brand ?? car.brand).trim(),
      model: String(body.model ?? car.model).trim(),
      year: Number(body.year ?? car.year),
      price: Number(body.price ?? car.price),
      mileage: Number(body.mileage ?? car.mileage),
      city: String(body.city ?? car.city).trim(),
      district: String(body.district ?? "").trim(),
      description: String(body.description ?? car.description).trim(),
      contactPhone: String(body.contactPhone ?? car.contactPhone).trim(),
      minOffer: Math.trunc(Number(body.minOffer ?? car.minOffer) || 0),
      images: images ?? (car.images as string[] | undefined) ?? [],
    };

    const fields = validateListingFields(input);
    if (!fields.valid) {
      return NextResponse.json({ error: fields.errors.join(" ") }, { status: 400 });
    }

    const minCheck = validateMinOffer(input.minOffer, input.price);
    if (!minCheck.valid) {
      return NextResponse.json({ error: minCheck.error }, { status: 400 });
    }

    const outcome = await moderateNewListing(input);

    car.brand = input.brand;
    car.model = input.model;
    car.year = input.year;
    car.mileage = input.mileage;
    car.city = input.city;
    if (input.district) car.address = `${input.district}, ${input.city}`;
    car.description = input.description;
    car.contactPhone = input.contactPhone;
    car.minOffer = input.minOffer;
    car.title = `${input.brand} ${input.model} ${input.year}`.trim();
    if (images) {
      car.images = images;
      car.imageUrl = images[0] || car.imageUrl;
    }
    // Fiyat değiştiyse geçmişe ekle
    if (input.price !== car.price) car.priceHistory.push({ price: input.price });
    car.price = input.price;

    car.moderationStatus = outcome.status;
    car.rejectionReason = outcome.status === "rejected" ? outcome.reason : "";
    await car.save();

    if (outcome.status === "approved") {
      await logAudit({ action: "listing_approved", targetLabel: car.title });
    } else if (outcome.status === "rejected") {
      await logAudit({ action: "listing_rejected", targetLabel: car.title, reason: outcome.reason });
    }

    return NextResponse.json({ status: outcome.status, reason: outcome.reason });
  } catch (error) {
    console.error("PATCH /api/listings/[id] error:", error);
    return NextResponse.json({ error: "İlan güncellenemedi." }, { status: 500 });
  }
}

/** Kendi ilanını sil. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const { id } = await context.params;
    await connectDB();
    const car = await ownedCar(id, authUser.userId);
    if (!car) return NextResponse.json({ error: "İlan bulunamadı veya yetkiniz yok." }, { status: 404 });

    await car.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/listings/[id] error:", error);
    return NextResponse.json({ error: "İlan silinemedi." }, { status: 500 });
  }
}
