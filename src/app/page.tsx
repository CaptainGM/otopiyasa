import { Suspense } from "react";
import Link from "next/link";
import { CarCard } from "@/components/CarCard";
import { CarFilters } from "@/components/CarFilters";
import { DealsStrip } from "@/components/DealsStrip";
import { TrendingStrip } from "@/components/TrendingStrip";
import { NearbyListings } from "@/components/NearbyListings";
import { RecentlyViewedStrip } from "@/components/RecentlyViewedStrip";
import { Pagination } from "@/components/Pagination";
import { ScrapePanel } from "@/components/ScrapePanel";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { findCarsPage, parseCarFilters } from "@/lib/car-query";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc } from "@/lib/serialize-car";
import { Car as CarType } from "@/types";
import { getCurrentUser } from "@/lib/auth";
import { getColorOptions, type ColorOption } from "@/lib/color-counts";
import { cached, CACHE_TTL } from "@/lib/cache";
import { getBrandModelOptions } from "@/lib/brand-models";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const rawParams = await searchParams;
  const urlParams = new URLSearchParams();

  Object.entries(rawParams).forEach(([key]) => {
    const param = getParam(rawParams, key);
    if (param) urlParams.set(key, param);
  });

  const filters = parseCarFilters(urlParams);
  const activeParams = Object.fromEntries(urlParams.entries());
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  let items: CarType[] = [];
  let total = 0;
  let totalPages = 1;
  let dbError = false;
  let brandOptions: string[] = [];
  let cityOptions: string[] = [];
  let colorOptions: ColorOption[] = [];
  let brandModelOptions: Record<string, string[]> = {};

  try {
    await connectDB();

    // Filtre seçenekleri herkes için aynı ve yalnızca taramada değişir → önbellek
    // (aksi hâlde her sayfa geçişinde 8000 araç üzerinde 3 ağır sorgu koşuyordu).
    let brandModelData: { brands: string[]; brandModels: Record<string, string[]> };
    [brandModelData, cityOptions, colorOptions] = await Promise.all([
      getBrandModelOptions(),
      cached("home:cities", CACHE_TTL.medium, async () =>
        ((await Car.distinct("city")) as string[])
          .filter((c) => c && c !== "Türkiye")
          .sort((a, b) => a.localeCompare(b, "tr"))
      ),
      cached("home:colors", CACHE_TTL.medium, () => getColorOptions()),
    ]);
    brandOptions = brandModelData.brands;
    brandModelOptions = brandModelData.brandModels;

    const { docs: cars, total: count, limit } = await findCarsPage(filters);
    const docs = cars.filter(isLeanCarDoc);
    const marketMap = await getMarketMap(
      docs.map((car) => ({
        brand: car.brand,
        model: car.model,
        year: car.year,
      }))
    );
    items = attachMarketToCars(docs, marketMap);

    total = count;
    totalPages = Math.ceil(total / limit) || 1;
  } catch (error) {
    console.error("HomePage veri yükleme hatası:", error);
    dbError = true;
  }

  // Arama/filtre aktifken tanıtım (hero) ve "Haftanın fırsatları" gizlenir;
  // bunlar yalnızca boş Keşfet görünümünde çıkar. Metin araması (q) ayrıca
  // filtre panelini de gizler → sadece sonuçlar görünür.
  const hasQuery = !!filters.q?.trim();
  const hasAnyFilter =
    hasQuery ||
    !!filters.brand ||
    !!filters.model ||
    !!filters.city ||
    !!filters.color ||
    !!filters.yearMin ||
    !!filters.yearMax ||
    !!filters.priceMin ||
    !!filters.priceMax ||
    !!filters.fuelType ||
    !!filters.transmission;

  return (
    <div className="space-y-8 pb-10">
      {!hasAnyFilter && (
      <section className="hero card overflow-hidden p-6 sm:p-8 md:p-10">
        <div className="hero-grid items-center">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
              OtoPiyasa mobil + web
            </p>
            <h1 className="max-w-2xl text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              Türkiye ilan piyasasından{" "}
              <span className="text-amber-300">araç fiyatlarını</span>{" "}
              takip et
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-slate-400">
              Arabam ve Otomerkezi kaynaklı ilanları filtrele. Her araç için marka /
              model / yıl bazında piyasa ortalamasını gör, gerçek ilana tek tıkla ulaş.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="stat-tile">
              <span className="stat-tile-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 17h1.5a2.5 2.5 0 0 0 5 0h3a2.5 2.5 0 0 0 5 0H20a1 1 0 0 0 1-1v-3.28a2 2 0 0 0-.4-1.2l-2.4-3.2a2 2 0 0 0-1.6-.8H15V6a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <circle cx="7.5" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="16" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <div>
                <span className="text-xs uppercase tracking-widest text-slate-500">
                  Aktif ilan
                </span>
                <strong>{total}</strong>
              </div>
            </div>
            <div className="stat-tile sm:col-span-2">
              <span className="stat-tile-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <span className="text-xs uppercase tracking-widest text-slate-500">
                  Kendi ilanın
                </span>
                <strong className="text-lg">Ücretsiz ilan ver</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {isAdmin && <ScrapePanel />}

      {!hasAnyFilter && <RecentlyViewedStrip />}

      {!hasAnyFilter && <NearbyListings />}

      {!hasAnyFilter && <DealsStrip />}

      {!hasAnyFilter && <TrendingStrip />}

      {dbError && (
        <div className="card border border-red-400/30 bg-red-500/10 p-5 text-red-200">
          MongoDB bağlantısı kurulamadı. `.env` dosyasını kontrol et.
        </div>
      )}

      {hasQuery ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-slate-400">
            <span className="text-slate-200">&ldquo;{filters.q}&rdquo;</span> için arama sonuçları
          </p>
          <Link href="/" className="btn btn-secondary text-sm">
            ← Aramayı temizle
          </Link>
        </div>
      ) : (
        <Suspense fallback={<div className="card p-5 text-slate-400">Filtreler yükleniyor...</div>}>
          <CarFilters
            availableBrands={brandOptions}
            availableCities={cityOptions}
            availableColors={colorOptions}
            brandModels={brandModelOptions}
          />
        </Suspense>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{total} ilan</h2>
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-full border border-white/10 text-xs font-bold">
              <span className="bg-amber-400/15 px-3 py-1.5 text-amber-300">Liste</span>
              <Link
                href="/map"
                className="px-3 py-1.5 text-slate-400 transition hover:bg-white/5 hover:text-[var(--text)]"
              >
                Harita
              </Link>
            </div>
            <p className="text-sm text-slate-500">
              Sayfa {filters.page || 1} / {totalPages}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-14 text-center text-slate-400">
            <span className="stat-tile-icon h-12 w-12 rounded-2xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 17h1.5a2.5 2.5 0 0 0 5 0h3a2.5 2.5 0 0 0 5 0H20a1 1 0 0 0 1-1v-3.28a2 2 0 0 0-.4-1.2l-2.4-3.2a2 2 0 0 0-1.6-.8H15V6a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <circle cx="7.5" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="16" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <p>Henüz ilan yok. Üstten demo veya gerçek kaynaklardan veri çek.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((car) => (
                <CarCard key={car._id} car={car} />
              ))}
            </div>
            <Pagination
              page={filters.page || 1}
              totalPages={totalPages}
              params={activeParams}
            />
          </>
        )}
      </section>
    </div>
  );
}
