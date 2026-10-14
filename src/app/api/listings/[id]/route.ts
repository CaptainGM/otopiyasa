import { revalidateListing } from "@/lib/revalidate-listing";
import { readJson } from "@/lib/http";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { validateListingFields, validateListingImages } from "@/lib/listing-validation";
import { moderateNewListing } from "@/lib/listing-moderation";
import { validateMinOffer } from "@/lib/offers";
import { logAudit } from "@/lib/audit-log";
import { normalizeFuelType } from "@/lib/normalize-fuel";
import { loadSegmentCap } from "@/lib/segment-cap-data";
import { segmentCapMessage } from "@/lib/segment-cap";
import { loadSellEstimate } from "@/lib/sell-estimate-data";
import {
  damageToFields,
  isElectricFuel,
  parseEngineSize,
  parseListingDamage,
  priceGuard,
  storedDamage,
  type SellDamage,
} from "@/lib/sell-estimate";

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
    const limited = await checkSharedRateLimit(request, "edit-listing", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const { id } = await context.params;
    await connectDB();
    const car = await ownedCar(id, authUser.userId);
    if (!car) return NextResponse.json({ error: "İlan bulunamadı veya yetkiniz yok." }, { status: 404 });

    const body = await readJson(request);
    /**
     * Fotoğraflar moderasyona da GİRMELİ.
     *
     * Önceden `images` yalnızca kayda yazılıyor, `moderateNewListing`e
     * geçirilmiyordu; yani fotoğraf-marka uyum kontrolü (Gemini Vision)
     * düzenlemede hiç çalışmıyordu. Honda fotoğrafıyla Honda ilanı verip
     * onaylandıktan sonra markayı "Volkswagen" olarak düzenlemek denetimi
     * tamamen atlıyordu.
     */
    const imageCheck = body.images === undefined
      ? null
      : validateListingImages(body.images);
    if (imageCheck?.error) {
      return NextResponse.json({ error: imageCheck.error }, { status: 400 });
    }
    const images = imageCheck?.images ?? null;

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
      // Düzenleme formu yakıt/vites/kasa/renk de gönderiyor; eskiden bunlar yok sayılıyordu (değişiklik kayboluyordu).
      fuelType: body.fuelType !== undefined ? normalizeFuelType(String(body.fuelType || "")) : undefined,
      transmission: body.transmission !== undefined ? String(body.transmission || "").trim() : undefined,
      bodyType: body.bodyType !== undefined ? String(body.bodyType || "").trim() : undefined,
      color: body.color !== undefined ? String(body.color || "").trim() : (car as any).features?.color,
    };

    const fields = validateListingFields(input);
    if (!fields.valid) {
      return NextResponse.json({ error: fields.errors.join(" ") }, { status: 400 });
    }

    const minCheck = validateMinOffer(input.minOffer, input.price);
    if (!minCheck.valid) {
      return NextResponse.json({ error: minCheck.error }, { status: 400 });
    }

    // Hasar ve motor hacmi gönderilmediyse kayıtlı değer korunur (eski mobil sürümler bu alanları göndermez).
    const damageInput = parseListingDamage(body.damage);
    if (!damageInput.ok) return NextResponse.json({ error: damageInput.error }, { status: 400 });
    const engineInput = body.engineSize === undefined ? null : parseEngineSize(body.engineSize);
    if (engineInput && !engineInput.ok) return NextResponse.json({ error: engineInput.error }, { status: 400 });

    const damageGiven: SellDamage | null = damageInput.value;
    const fuelAfter = input.fuelType ?? car.features?.fuelType ?? "";
    const transmissionAfter = input.transmission ?? car.features?.transmission ?? "";
    const storedEngine = car.features?.engineSize ?? null;
    const engineAfter = isElectricFuel(fuelAfter) ? null : engineInput?.ok ? engineInput.value : storedEngine;
    const damageAfter: SellDamage | null = damageGiven ?? storedDamage(car);

    const priceChanged = input.price !== car.price;
    const subjectChanged =
      input.brand !== car.brand ||
      input.model !== car.model ||
      input.year !== car.year ||
      input.mileage !== car.mileage ||
      fuelAfter !== (car.features?.fuelType ?? "") ||
      transmissionAfter !== (car.features?.transmission ?? "") ||
      engineAfter !== storedEngine ||
      damageAfter !== storedDamage(car);

    // Fiyat ya da araç bilgisi değiştiyse kayıttaki kuralların aynısı: segment tavanı ve fiyat aralığı. Yalnızca açıklama
    // değişiyorsa atlanır; yoksa piyasa kaymasıyla eski bir ilan düzenlenemez hâle gelirdi.
    let sell: Awaited<ReturnType<typeof loadSellEstimate>> | null = null;
    if (priceChanged || subjectChanged) {
      const capError = segmentCapMessage(input.price, await loadSegmentCap(input.brand, input.model));
      if (capError) return NextResponse.json({ error: capError }, { status: 400 });

      sell = await loadSellEstimate({
        brand: input.brand,
        model: input.model,
        year: input.year,
        mileage: input.mileage,
        fuelType: fuelAfter,
        transmission: transmissionAfter,
        engineSize: engineAfter,
        damage: damageAfter,
        // Kendi eski ilanı emsal sayılmaz.
        excludeId: String(car._id),
      });
      const priceCheck = priceGuard(input.price, sell.estimate, { damageKnown: sell.damageKnown });
      if (priceCheck.level === "block") return NextResponse.json({ error: priceCheck.message }, { status: 400 });
    }

    const outcome = await moderateNewListing({
      ...input,
      damaged: damageAfter === null ? null : damageAfter === "hasarli",
      skipRelativeFloor: Boolean(sell?.estimate.confident && sell.damageKnown),
    });

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
    if (damageGiven) {
      const fields = damageToFields(damageGiven);
      car.damageFlag = fields.damageFlag;
      car.paintChange = fields.paintChange;
    }
    car.set("features.engineSize", engineAfter ?? undefined);
    if (input.fuelType) car.set("features.fuelType", input.fuelType);
    if (input.transmission) car.set("features.transmission", input.transmission);
    if (input.bodyType) car.set("features.bodyType", input.bodyType);
    if (input.color) car.set("features.color", input.color);
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
    revalidateListing(car._id);

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
    revalidateListing(car._id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/listings/[id] error:", error);
    return NextResponse.json({ error: "İlan silinemedi." }, { status: 500 });
  }
}
