import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { isLeanCarDoc } from "@/lib/serialize-car";
import { formatPrice } from "@/lib/utils";
import { CarDetailBody } from "./CarDetailBody";
import { RestrictedListingGate } from "@/components/ListingViewerIslands";

/**
 * İlan sayfası ISR ile 3 dakika (180 sn) önbellekte tutulur.
 * Yeni sekmede veya tekrarlayan açılışlarda sunucu veritabanına sorgu atmadan
 * doğrudan önbellekten 0-5 ms içinde anında yanıt verir.
 * Kullanıcıya özel durumlar (favori, teklifler, sorular) istemci adalarında yüklenir.
 */
export const revalidate = 180;

interface CarDetailPageProps {
  params: Promise<{ id: string }>;
}

const getCachedCar = cache(async (id: string) => {
  return cached(`car-doc:${id}`, CACHE_TTL.short, async () => {
    await connectDB();
    return Car.findById(id).lean();
  });
});

/** Herkese açık mı: aktif ve (üye ilanıysa) onaylı. */
function isPublicListing(carDoc: { status?: string; moderationStatus?: string }) {
  const inactive = carDoc.status === "removed" || carDoc.status === "sold";
  const unapproved = carDoc.moderationStatus === "pending" || carDoc.moderationStatus === "rejected";
  return !inactive && !unapproved;
}

export async function generateMetadata({
  params,
}: CarDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const car = (await getCachedCar(id)) as {
      title?: string;
      brand?: string;
      model?: string;
      year?: number;
      price?: number;
      city?: string;
      images?: string[];
      status?: string;
      moderationStatus?: string;
    } | null;
    if (!car || !car.brand || !car.model) return { title: "İlan Bulunamadı | OtoPiyasa" };
    if (!isPublicListing(car)) return { title: "İlan | OtoPiyasa", robots: { index: false } };

    const title = `${car.brand} ${car.model} ${car.year} Fiyatı & Piyasa Analizi | OtoPiyasa`;
    const description = `${car.year} model ${car.brand} ${car.model} ${car.city ? `(${car.city})` : ""}. Piyasa değeri, ekspertiz durumu ve fiyat analizi. ${formatPrice(car.price || 0)}.`;

    return {
      title,
      description,
      alternates: {
        canonical: `/cars/${id}`,
      },
      openGraph: {
        title,
        description,
        type: "article",
        images: car.images?.[0] ? [{ url: car.images[0] }] : undefined,
      },
    };
  } catch {
    return {
      title: "Araç Detayı | OtoPiyasa",
    };
  }
}

export default async function CarDetailPage({ params }: CarDetailPageProps) {
  const { id } = await params;
  let carDoc: any = null;
  try {
    carDoc = await getCachedCar(id);
  } catch {
    notFound();
  }
  if (!isLeanCarDoc(carDoc)) notFound();
  if (!isPublicListing(carDoc)) return <RestrictedListingGate carId={id} />;
  return <CarDetailBody carDoc={carDoc} />;
}
