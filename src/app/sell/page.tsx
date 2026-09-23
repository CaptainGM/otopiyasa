import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SellForm } from "@/components/SellForm";
import { connectDB } from "@/lib/mongodb";
import { getBrandModelOptions } from "@/lib/brand-models";

export const metadata = { title: "İlan Ver | OtoPiyasa" };
export const dynamic = "force-dynamic";

export default async function SellPage() {
  // İlan vermek giriş gerektirir (middleware de korur; burada da garanti).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell");

  // Marka ve model listesi ortak normalize kaynaktan (getBrandModelOptions)
  await connectDB();
  const { brands, brandModels } = await getBrandModelOptions();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-black">Araç İlanı Ver</h1>
      <p className="mt-1 mb-6 text-slate-400">
        İlanın, yapay zeka denetiminden geçtikten sonra yayınlanır. Uygun bulunmazsa
        sana e-posta ile sebebini bildiririz.
      </p>
      <SellForm brands={brands} brandModels={brandModels} />
    </div>
  );
}
