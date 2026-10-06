import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { formatPrice, formatRelativeTr } from "@/lib/utils";
import { UNVERIFIED_ARABAM_FILTER, UNVERIFIED_PAGE_SIZE, UNVERIFIED_PROJECTION } from "@/lib/unverified-listings";

export const metadata = { title: "Kontrol Edilmemiş İlanlar | OtoPiyasa" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function UnverifiedListingsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const params = await searchParams;
  const currentPage = Math.max(1, Math.min(Number(params.page) || 1, 10_000));

  await connectDB();
  const [total, cars] = await Promise.all([
    Car.countDocuments(UNVERIFIED_ARABAM_FILTER),
    Car.find(UNVERIFIED_ARABAM_FILTER, UNVERIFIED_PROJECTION)
      .sort({ createdAt: 1, _id: 1 })
      .skip((currentPage - 1) * UNVERIFIED_PAGE_SIZE)
      .limit(UNVERIFIED_PAGE_SIZE)
      .lean(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / UNVERIFIED_PAGE_SIZE));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin" className="text-xs text-slate-400 transition hover:text-white">
            ← Yönetim Paneline Dön
          </Link>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">Kontrol Edilmemiş İlanlar</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Arabam bekçisinin henüz hiç doğrulamadığı aktif ilanlar. Bekçi sırayla kontrol ettikçe buradan düşer.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kontrol Bekleyen</p>
          <p className="text-xl font-black text-amber-400">{total.toLocaleString("tr-TR")}</p>
        </div>
      </div>

      {cars.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <p className="text-base font-semibold">Kontrol bekleyen ilan kalmadı.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">İlan</th>
                <th className="px-4 py-3">Yıl</th>
                <th className="px-4 py-3">Fiyat</th>
                <th className="px-4 py-3">Eklendi</th>
                <th className="px-4 py-3">Son deneme</th>
                <th className="px-4 py-3 text-right">Bağlantı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cars.map((car: any) => (
                <tr key={car._id.toString()} className="transition hover:bg-slate-800/30">
                  <td className="max-w-[320px] px-4 py-3">
                    <Link href={`/cars/${car._id}`} className="block truncate text-xs font-semibold text-white hover:underline" title={car.title}>
                      {car.title}
                    </Link>
                    <p className="text-[11px] text-slate-400">
                      {car.brand} {car.model} · {car.city || "Şehir yok"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-200">{car.year || "—"}</td>
                  <td className="px-4 py-3 text-xs font-black text-amber-400">{car.price ? formatPrice(car.price) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {car.createdAt ? new Date(car.createdAt).toLocaleDateString("tr-TR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {car.lastVerifyAttemptAt ? formatRelativeTr(car.lastVerifyAttemptAt) : "hiç denenmedi"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {car.listingUrl && (
                      <a
                        href={car.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        Orijinal ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
          <p>
            Toplam <strong className="text-white">{total.toLocaleString("tr-TR")}</strong> ilandan{" "}
            <strong className="text-white">{(currentPage - 1) * UNVERIFIED_PAGE_SIZE + 1}</strong> -{" "}
            <strong className="text-white">{Math.min(currentPage * UNVERIFIED_PAGE_SIZE, total)}</strong> arası.
          </p>
          <div className="flex items-center gap-2">
            {currentPage > 1 && (
              <Link href={`/admin/unverified?page=${currentPage - 1}`} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-white transition hover:bg-slate-800">
                ← Önceki
              </Link>
            )}
            <span className="px-2 font-bold text-slate-300">
              {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link href={`/admin/unverified?page=${currentPage + 1}`} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-white transition hover:bg-slate-800">
                Sonraki →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
