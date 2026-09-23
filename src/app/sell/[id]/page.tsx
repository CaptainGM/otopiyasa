import { redirect, notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { SellForm } from "@/components/SellForm";
import { cached, CACHE_TTL } from "@/lib/cache";
import { isNonCarBrand } from "@/lib/normalize-brand";

export const metadata = { title: "İlanı Düzenle | OtoPiyasa" };
export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  const { id } = await params;
  await connectDB();
  const car = await Car.findById(id)
    .select("brand model year price mileage city address description contactPhone minOffer images features ownerId")
    .lean<{
      brand: string; model: string; year: number; price: number; mileage: number;
      city: string; address?: string; description?: string; contactPhone?: string; minOffer?: number; images?: string[];
      features?: { fuelType?: string; transmission?: string; bodyType?: string; color?: string };
      ownerId?: { toString(): string };
    }>();

  // Yalnızca kendi ilanını düzenleyebilir
  if (!car || !car.ownerId || car.ownerId.toString() !== authUser.userId) notFound();

  const brands = await cached("sell:brands", CACHE_TTL.long, async () =>
    ((await Car.distinct("brand")) as string[])
      .filter((b) => b && !isNonCarBrand(b))
      .sort((a, b) => a.localeCompare(b, "tr"))
  );

  const initial = {
    brand: car.brand,
    model: car.model,
    year: car.year,
    price: car.price,
    mileage: car.mileage,
    city: car.city,
    // address "İlçe, İl" biçiminde tutuluyor → ilçeyi geri ayıkla.
    district: (car.address || "").split(",")[0].trim(),
    description: car.description || "",
    contactPhone: car.contactPhone || "",
    minOffer: car.minOffer || 0,
    fuelType: car.features?.fuelType || "",
    transmission: car.features?.transmission || "",
    bodyType: car.features?.bodyType || "",
    color: car.features?.color || "",
    images: car.images || [],
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-black">İlanı Düzenle</h1>
      <p className="mt-1 mb-6 text-slate-400">
        Değişikliklerin tekrar yapay zeka denetiminden geçer.
      </p>
      <SellForm initial={initial} listingId={id} brands={brands} />
    </div>
  );
}
