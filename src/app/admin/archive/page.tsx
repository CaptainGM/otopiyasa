import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { formatPrice } from "@/lib/utils";
import { SourceBadge } from "@/components/SourceBadge";
import { ListingSource } from "@/types";

export const metadata = { title: "Piyasa Arşivi (Kaldırılan İlanlar) | OtoPiyasa" };
export const dynamic = "force-dynamic";

interface ArchivePageProps {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    city?: string;
    damage?: string;
    page?: string;
  }>;
}

export default async function AdminArchivePage({ searchParams }: ArchivePageProps) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const brand = params.brand?.trim() || "";
  const city = params.city?.trim() || "";
  const damage = params.damage || "";
  const currentPage = Math.max(1, Number(params.page) || 1);
  const pageSize = 20;

  await connectDB();

  // Filtreleme koşulları: Yalnızca status: 'removed' (arşivlenmiş/kaldırılmış) olanlar
  const filter: Record<string, any> = {
    status: "removed",
  };

  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { brand: { $regex: q, $options: "i" } },
      { model: { $regex: q, $options: "i" } },
    ];
  }
  if (brand) {
    filter.brand = { $regex: `^${brand}$`, $options: "i" };
  }
  if (city) {
    filter.city = { $regex: `^${city}$`, $options: "i" };
  }
  if (damage === "yes") {
    filter.damageFlag = true;
  } else if (damage === "no") {
    filter.damageFlag = false;
  }

  const [totalCount, cars, totalActiveCount] = await Promise.all([
    Car.countDocuments(filter),
    Car.find(filter)
      .sort({ updatedAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Car.countDocuments({ status: { $ne: "removed" } }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-slate-400 hover:text-white transition">
              ← Yönetim Paneline Dön
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">Piyasa Arşivi (Kaldırılan İlanlar)</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Kaynaktan satılmış veya yayından kaldırılmış, ancak fiyat ve detaylı hasar analizleri için saklanan araçlar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-right">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Arşivlenen Araç</p>
            <p className="text-xl font-black text-amber-400">{totalCount.toLocaleString("tr-TR")}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-right">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Aktif Vitrin</p>
            <p className="text-xl font-black text-emerald-400">{totalActiveCount.toLocaleString("tr-TR")}</p>
          </div>
        </div>
      </div>

      {/* Arama ve Filtre Çubuğu */}
      <form method="GET" className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-400">Kelime ile Ara</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Başlık, marka veya model..."
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">Marka</label>
            <input
              type="text"
              name="brand"
              defaultValue={brand}
              placeholder="Örn: Renault, BMW"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">Şehir</label>
            <input
              type="text"
              name="city"
              defaultValue={city}
              placeholder="Örn: İstanbul"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">Hasar Kaydı</label>
            <select
              name="damage"
              defaultValue={damage}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Tümü</option>
              <option value="yes">Ağır Hasarlı Var</option>
              <option value="no">Hasarsız / Normal</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {Boolean(q || brand || city || damage) && (
            <Link
              href="/admin/archive"
              className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Filtreleri Temizle
            </Link>
          )}
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition"
          >
            Filtrele
          </button>
        </div>
      </form>

      {/* Araç Listesi */}
      {cars.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <p className="text-base font-semibold">Arşivde kriterlere uyan araç bulunamadı.</p>
          <p className="mt-1 text-xs text-slate-500">
            Tarama esnasında kaldırılan ilanlar otomatik olarak buraya eklenir.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Görsel / Araç</th>
                <th className="px-4 py-3">Marka & Model</th>
                <th className="px-4 py-3">Yıl / Km</th>
                <th className="px-4 py-3">Son Fiyat</th>
                <th className="px-4 py-3">Hasar & Detay</th>
                <th className="px-4 py-3">Kapanma Tarihi</th>
                <th className="px-4 py-3 text-right">Kaynak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cars.map((car: any) => {
                const damagePartsCount = car.damageParts?.length || 0;
                return (
                  <tr key={car._id.toString()} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-800 border border-slate-700">
                          {car.imageUrl ? (
                            <img
                              src={car.imageUrl}
                              alt={car.title}
                              className="h-full w-full object-cover grayscale-[30%]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                              Yok
                            </div>
                          )}
                        </div>
                        <div className="max-w-[220px]">
                          <p className="truncate font-semibold text-white text-xs" title={car.title}>
                            {car.title}
                          </p>
                          <p className="text-[11px] text-slate-400">{car.city || "Şehir belirtilmemiş"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-200 text-xs">{car.brand}</p>
                      <p className="text-[11px] text-slate-400">{car.model}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200 text-xs">{car.year}</p>
                      <p className="text-[11px] text-slate-400">
                        {car.mileage ? `${car.mileage.toLocaleString("tr-TR")} km` : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-black text-amber-400 text-xs">
                        {car.price ? formatPrice(car.price) : "—"}
                      </p>
                      {car.priceHistory?.length > 1 && (
                        <span className="text-[10px] text-slate-500">
                          {car.priceHistory.length} fiyat değişimi
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-xs">
                        {car.damageFlag ? (
                          <span className="inline-block rounded bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                            Ağır Hasarlı
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            Normal
                          </span>
                        )}
                        {damagePartsCount > 0 && (
                          <p className="text-[10px] text-amber-300/80">
                            {damagePartsCount} parça hasar kaydı
                          </p>
                        )}
                        {car.paintChange && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px]" title={car.paintChange}>
                            {car.paintChange}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-300">
                        {car.updatedAt ? new Date(car.updatedAt).toLocaleDateString("tr-TR") : "—"}
                      </p>
                      <span className="inline-block rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] text-slate-400">
                        Arşivlendi
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <SourceBadge source={(car.sourceSite || "arabam") as ListingSource} />
                        {car.listingUrl && (
                          <a
                            href={car.listingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            Orijinal Link ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
          <p>
            Toplam <strong className="text-white">{totalCount}</strong> kayıttan{" "}
            <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> -{" "}
            <strong className="text-white">{Math.min(currentPage * pageSize, totalCount)}</strong> arası gösteriliyor.
          </p>
          <div className="flex items-center gap-2">
            {currentPage > 1 && (
              <Link
                href={`/admin/archive?page=${currentPage - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${brand ? `&brand=${encodeURIComponent(brand)}` : ""}${city ? `&city=${encodeURIComponent(city)}` : ""}${damage ? `&damage=${damage}` : ""}`}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800 transition"
              >
                ← Önceki
              </Link>
            )}
            <span className="px-2 font-bold text-slate-300">
              {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link
                href={`/admin/archive?page=${currentPage + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${brand ? `&brand=${encodeURIComponent(brand)}` : ""}${city ? `&city=${encodeURIComponent(city)}` : ""}${damage ? `&damage=${damage}` : ""}`}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800 transition"
              >
                Sonraki →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
