import { notFound, redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { isLeanCarDoc } from "@/lib/serialize-car";
import { CarDetailBody } from "../CarDetailBody";

export const dynamic = "force-dynamic";
export const metadata = { title: "İlan önizleme | OtoPiyasa", robots: { index: false, follow: false } };

/**
 * Herkese açık olmayan ilanın (onay bekleyen/reddedilen üye ilanı, arşiv, satıldı) önizlemesi:
 * yalnızca ilan sahibi ve yönetici. Herkese açık ilan sayfası önbellekte olduğu için bu kontrol orada yapılamaz.
 */
export default async function CarPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/cars/${id}/onizleme`);
  await connectDB();
  let carDoc: any = null;
  try {
    carDoc = await Car.findById(id).lean();
  } catch {
    notFound();
  }
  if (!isLeanCarDoc(carDoc)) notFound();
  const isOwner = !!carDoc.ownerId && carDoc.ownerId.toString() === viewer.userId;
  if (!isOwner && viewer.role !== "admin") notFound();
  return <CarDetailBody carDoc={carDoc} />;
}
