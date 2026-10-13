export const revalidate = 60;
export const maxDuration = 30;

import { Suspense } from "react";
import Link from "next/link";
import { InfiniteCarList } from "@/components/InfiniteCarList";
import { CarFilters } from "@/components/CarFilters";
import { DealsStrip } from "@/components/DealsStrip";
import { TrendingStrip } from "@/components/TrendingStrip";
import { NearbyListings } from "@/components/NearbyListings";
import { RecentlyViewedStrip } from "@/components/RecentlyViewedStrip";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { countCars, findCarsPage, parseCarFilters } from "@/lib/car-query";
import { attachMarketToCars, isLeanCarDoc } from "@/lib/serialize-car";
import { Car as CarType } from "@/types";
import { getColorOptions, type ColorOption } from "@/lib/color-counts";
import { cached, CACHE_TTL } from "@/lib/cache";
import { getBrandModelOptions } from "@/lib/brand-models";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { feedBucket, feedStartSlot, isMixedSort } from "@/lib/car-mix";
import { normalizeCity } from "@/lib/normalize-city";
import { serializeCarListItem } from "@/lib/serialize-car-list-item";
import { getMarketBoard, type MarketBoard } from "@/lib/market-board";
import { VEHICLE_CLASSES } from "@/lib/vehicle-scope";
import { Icon } from "@/components/Icon";

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
  // "Keşfet" akışı: her sayfa yüklemesinde (tarayıcı yenileme dahil) yeni tohum; aynı tohum
  // sonsuz kaydırmadaki sonraki sayfalara da gider, böylece sayfalar arasında tekrar/atlama olmaz.
  // Karışık sıralı Keşfet: ilanlar tarayıcıda rastgele dilimden yüklenip karıştırılır (InfiniteCarList feed).
  // Sayfa HTML'i bu yüzden herkes için aynıdır ve CDN'de saklanabilir; kişiye özel tohum/çerez yok.
  // Arama ya da herhangi bir filtre var mı (araç tipi sekmesi sayılmaz: o, büyük bir listeyi daraltmaz).
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
    !!filters.mileageMin ||
    !!filters.mileageMax ||
    !!filters.seller ||
    !!filters.noDamage ||
    !!filters.fuelType ||
    !!filters.transmission ||
    !!filters.deals ||
    filters.excludeOutliers ||
    filters.discountOnly;
  // Rastgele dilim akışı yalnızca filtresiz açılışta. Arama ya da filtre varsa ilk sayfa sunucudan gelir: sonuç azdır, hızlıdır
  // ve her filtre bileşiminin ayrı, önbelleksiz bir dilim isteği (soğuk sunucu + boş ekran) olması önlenir.
  const isFeed = isMixedSort(filters.sort) && !hasAnyFilter;
  filters.seed = undefined;
  // İlk HTML'de 12 kart: 48 kartlık sayfa 670 KB'tı ve her ziyaret sunucudan o kadar veri çekiyordu.
  // Kalanı sonsuz kaydırma yükler (aynı limit ve tohumla).
  // (parseCarFilters limit verilmediğinde 48'e düşürür; açıkça istenmediyse 12 kullan.)
  const pageSize = isFeed ? 24 : urlParams.has("limit") ? filters.limit || 12 : 12;
  filters.limit = pageSize;
  const listParams = new URLSearchParams(urlParams);
  listParams.delete("page");
  listParams.set("limit", String(pageSize));
  listParams.delete("seed");
  let items: CarType[] = [];
  // Keşfet'in sunucuda hazır ilk dilimi (dönem başına sabit): istemci bu dilimi ağ isteği olmadan gösterir.
  let feedStart: { slot: number; bucket: number } | undefined;
  let total = 0;
  let totalPages = 1;
  let dbError = false;
  let brandOptions: string[] = [];
  let cityOptions: string[] = [];
  let colorOptions: ColorOption[] = [];
  let brandModelOptions: Record<string, string[]> = {};
  let boardData: MarketBoard | null = null;
  // Aranan metin hiçbir ilanda tutmadığında yazım düzeltmesiyle bulunan sonuç (bkz. lib/search-correct.ts).
  let correction: { from: string; label: string } | undefined;

  try {
    await connectDB();

    // Filtre seçenekleri herkes için aynı ve yalnızca taramada değişir → önbellek
    // (aksi hâlde her sayfa geçişinde 8000 araç üzerinde 3 ağır sorgu koşuyordu).
    let brandModelData: { brands: string[]; brandFamilies: Record<string, string[]> };
    [brandModelData, cityOptions, colorOptions] = await Promise.all([
      getBrandModelOptions(filters.vehicleClass),
      cached("home:cities", CACHE_TTL.medium, async () =>
        [...new Set(((await Car.distinct("city", PUBLIC_LISTING_FILTER)) as string[])
          .filter((c) => c && c !== "Türkiye")
          .map(normalizeCity))]
          .sort((a, b) => a.localeCompare(b, "tr"))
      ),
      cached("home:colors", CACHE_TTL.medium, () => getColorOptions()),
    ]);
    brandOptions = brandModelData.brands;
    // Pano yalnızca filtresiz açılışta görünür; hata verirse sayfa onsuz açılır.
    boardData = await getMarketBoard().catch(() => null);
    // Filtrede model aileleri: "Juke" seçilince tüm Juke donanımları gelir.
    brandModelOptions = brandModelData.brandFamilies;

    if (isFeed) {
      total = await countCars(filters);
      totalPages = Math.ceil(total / pageSize) || 1;
      // İlk 24 kart HTML'de: ana sayfa ilk boyamada dolu gelir (eskiden JS yüklenip API'den çekilene kadar boştu).
      // Dilim ve dönem CDN'de saklanan HTML ile birlikte herkes için aynıdır; kullanıcı yenilediğinde istemci başka dilim seçer.
      const bucket = feedBucket();
      feedStart = { slot: feedStartSlot(bucket), bucket };
      const first = await findCarsPage({ ...filters, page: 1, slot: feedStart.slot, bucket: feedStart.bucket, limit: pageSize });
      items = attachMarketToCars(first.docs.filter(isLeanCarDoc), new Map());
    } else {
      const { docs: cars, total: count, limit, correction: fixed } = await findCarsPage(filters);
      correction = fixed;
      const docs = cars.filter(isLeanCarDoc);
      items = attachMarketToCars(docs, new Map());
      total = count;
      totalPages = Math.ceil(total / limit) || 1;
    }
  } catch (error) {
    console.error("HomePage veri yükleme hatası:", error);
    dbError = true;
  }

  // Arama/filtre aktifken tanıtım (hero) ve "Haftanın fırsatları" şeritleri gizlenir;
  // bunlar yalnızca boş Keşfet görünümünde çıkar. Filtre paneli HER durumda açıktır
  // (arama yapıp ardından marka/yıl/fiyat ile daraltmak mümkün olsun diye).
  // Fırsatlar, en çok bakılanlar, yakındakiler araç tipine göre süzülmüyor: tip seçilince gizlenir.
  const showStrips = !hasAnyFilter && !filters.vehicleClass;

  // "Aramayı temizle": yalnızca arama terimini (ve sayfa numarasını) kaldırır, diğer filtreler kalır.
  const clearQueryParams = new URLSearchParams();
  if (filters.brand) clearQueryParams.set("brand", filters.brand);
  if (filters.model) clearQueryParams.set("model", filters.model);
  if (filters.city) clearQueryParams.set("city", filters.city);
  if (filters.color) clearQueryParams.set("color", filters.color);
  if (filters.fuelType) clearQueryParams.set("fuelType", filters.fuelType);
  if (filters.transmission) clearQueryParams.set("transmission", filters.transmission);
  if (filters.vehicleClass) clearQueryParams.set("vehicleClass", filters.vehicleClass);
  if (filters.yearMin) clearQueryParams.set("yearMin", String(filters.yearMin));
  if (filters.yearMax) clearQueryParams.set("yearMax", String(filters.yearMax));
  if (filters.priceMin) clearQueryParams.set("priceMin", String(filters.priceMin));
  if (filters.priceMax) clearQueryParams.set("priceMax", String(filters.priceMax));
  if (filters.mileageMin) clearQueryParams.set("mileageMin", String(filters.mileageMin));
  if (filters.mileageMax) clearQueryParams.set("mileageMax", String(filters.mileageMax));
  if (filters.seller) clearQueryParams.set("seller", filters.seller);
  if (filters.noDamage) clearQueryParams.set("noDamage", "true");
  if (filters.sort && filters.sort !== "mixed") clearQueryParams.set("sort", filters.sort);
  if (filters.deals) clearQueryParams.set("firsat", "1");
  if (filters.discountOnly) clearQueryParams.set("discountOnly", "true");
  if (filters.excludeOutliers) clearQueryParams.set("excludeOutliers", "true");
  const clearQueryHref = clearQueryParams.size > 0 ? `/?${clearQueryParams.toString()}` : "/";

  const board = boardData;
  const activeClass = filters.vehicleClass;
  const listHeading = filters.deals
    ? "Haftanın fırsatları"
    : activeClass
    ? VEHICLE_CLASSES.find((c) => c.value === activeClass)?.label ?? "İlanlar"
    : hasAnyFilter
      ? "Sonuçlar"
      : "Tüm ilanlar";

  return (
    <div className="space-y-8 pb-10">
      {!hasAnyFilter && (
        <section className="card overflow-hidden">
          <div className="hero grid-paper grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:p-10">
            <div className="space-y-5">
              <p className="eyebrow flex items-center gap-2">
                <span className="live-dot" aria-hidden />
                Piyasa panosu · canlı
              </p>
              <h1 className="font-display text-[2.15rem] font-bold leading-[1.02] sm:text-5xl lg:text-[3.5rem]">
                Fiyat iyi mi?
                <br />
                <span className="text-[var(--muted)]">Piyasaya sor.</span>
              </h1>
              <p className="max-w-xl text-[0.95rem] leading-relaxed text-[var(--muted)]">
                {board ? `${board.sources} kaynaktan` : "Kaynak sitelerden"} toplanan her ilan kendi marka, model ve yıl
                emsalleriyle karşılaştırılır. Kartlardaki çizgi fiyatın yerini gösterir:{" "}
                <span className="text-[var(--cheap)]">ucuz</span>, <span className="text-[var(--fair)]">adil</span>,{" "}
                <span className="text-[var(--pricey)]">pahalı</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/predict" className="btn btn-primary">
                  <Icon name="spark" size={17} />
                  Aracımın değeri ne?
                </Link>
                <Link href="/analytics" className="btn btn-secondary">
                  Piyasa analizi
                </Link>
                <Link href="/sell" className="btn btn-ghost">
                  Ücretsiz ilan ver
                  <Icon name="arrowRight" size={16} />
                </Link>
              </div>
            </div>

            {board && (
              <dl className="board">
                <div className="board-cell">
                  <dt className="eyebrow">Aktif ilan</dt>
                  <dd className="num board-value">{board.total.toLocaleString("tr-TR")}</dd>
                </div>
                <div className="board-cell">
                  <dt className="eyebrow">Son 24 saat</dt>
                  <dd className="num board-value">+{board.addedLastDay.toLocaleString("tr-TR")}</dd>
                </div>
                <div className="board-cell">
                  <dt className="eyebrow">Piyasanın altında</dt>
                  <dd className="num board-value text-[var(--cheap)]">{board.belowMarket.toLocaleString("tr-TR")}</dd>
                </div>
                <div className="board-cell">
                  <dt className="eyebrow">Kaynak site</dt>
                  <dd className="num board-value">{board.sources}</dd>
                </div>
              </dl>
            )}
          </div>

          <nav
            aria-label="Araç tipi"
            className="flex gap-2 overflow-x-auto border-t border-[var(--border)] px-5 py-3 [scrollbar-width:none] sm:px-8 lg:px-10"
          >
            <Link href="/" className={`chip ${!activeClass ? "chip-active" : ""}`} aria-current={!activeClass ? "true" : undefined}>
              Tümü
            </Link>
            {VEHICLE_CLASSES.map((c) => {
              const count = board?.classCounts[c.value] ?? 0;
              if (count === 0) return null;
              const active = activeClass === c.value;
              return (
                <Link
                  key={c.value}
                  href={`/?vehicleClass=${c.value}`}
                  className={`chip ${active ? "chip-active" : ""}`}
                  aria-current={active ? "true" : undefined}
                >
                  {c.label}
                  <span className="num text-[0.72rem] opacity-60">{count.toLocaleString("tr-TR")}</span>
                </Link>
              );
            })}
          </nav>
        </section>
      )}

      {showStrips && <RecentlyViewedStrip />}

      {showStrips && <NearbyListings />}

      {showStrips && (
        <Suspense fallback={null}>
          <DealsStrip />
        </Suspense>
      )}

      {showStrips && (
        <Suspense fallback={null}>
          <TrendingStrip />
        </Suspense>
      )}

      {dbError && (
        <div className="card border-[var(--danger)] p-5 text-[var(--danger)]">
          İlanlar şu an yüklenemiyor. Birkaç dakika sonra yeniden deneyin.
        </div>
      )}

      {/*
        Filtre paneli arama yapıldığında da AÇIK kalır: kullanıcı önce arama yapıp sonra marka/yıl/fiyat
        ile daraltmak istiyor. Eskiden q doluyken panel tamamen gizlenip yerine "Aramayı temizle"
        konuyordu; arama yapan kullanıcı hiçbir filtre göremiyordu (arama terimi ve diğer filtreler
        birlikte çalışabildiği hâlde).
      */}
      <Suspense fallback={<div className="card p-5 text-[var(--muted)]">Filtreler yükleniyor...</div>}>
        <CarFilters
          availableBrands={brandOptions}
          availableCities={cityOptions}
          availableColors={colorOptions}
          brandModels={brandModelOptions}
        />
      </Suspense>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">
              {filters.deals ? "Adil değerinin %18–30 altındaki ilanlar" : isFeed ? "Keşfet · karışık sıra" : "Liste"}
            </p>
            <h2 className="font-display text-2xl font-semibold">
              {listHeading} <span className="num text-lg font-normal text-[var(--muted)]">{total.toLocaleString("tr-TR")}</span>
            </h2>
            {hasQuery && (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                {correction && items.length > 0 ? (
                  <span>
                    <span className="text-[var(--text)]">&ldquo;{correction.from}&rdquo;</span> ile eşleşen ilan yok;{" "}
                    <span className="text-[var(--accent)]">&ldquo;{correction.label}&rdquo;</span> sonuçları gösteriliyor
                  </span>
                ) : correction ? (
                  <span>
                    <span className="text-[var(--text)]">&ldquo;{correction.from}&rdquo;</span>{" "}
                    <span className="text-[var(--accent)]">&ldquo;{correction.label}&rdquo;</span> olarak arandı; eşleşen ilan yok
                  </span>
                ) : (
                  <span>
                    <span className="text-[var(--text)]">&ldquo;{filters.q}&rdquo;</span> için arama sonuçları
                  </span>
                )}
                {/* Yalnızca arama terimini kaldırır; marka/yıl/fiyat gibi diğer filtreler korunur. */}
                <Link href={clearQueryHref} className="chip">
                  <Icon name="close" size={13} />
                  Aramayı temizle
                </Link>
              </p>
            )}
          </div>
          <div className="segmented" role="group" aria-label="Görünüm">
            <span aria-current="true">
              <Icon name="grid" size={15} />
              Liste
            </span>
            <Link href="/map">
              <Icon name="map" size={15} />
              Harita
            </Link>
          </div>
        </div>

        {!isFeed && items.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-14 text-center text-[var(--muted)]">
            <Icon name="search" size={28} className="text-[var(--faint)]" />
            <p>Bu filtrelerle eşleşen ilan bulunamadı.</p>
            <Link href="/" className="btn btn-secondary text-sm">
              Filtreleri temizle
            </Link>
          </div>
        ) : (
          <InfiniteCarList
            initialItems={items.map(serializeCarListItem)}
            initialPage={filters.page || 1}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            query={listParams.toString()}
            feed={isFeed}
            feedStart={isFeed ? feedStart : undefined}
          />
        )}
      </section>
    </div>
  );
}
