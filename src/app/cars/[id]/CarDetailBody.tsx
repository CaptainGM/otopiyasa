import Link from "next/link";

import { User } from "@/models/User";
import { maskName } from "@/lib/form-options";
import { DamageDiagram } from "@/components/DamageDiagram";
import { CarGallery } from "@/components/CarGallery";
import { RecentlyViewedTracker } from "@/components/RecentlyViewedTracker";
import { CompareButton } from "@/components/CompareButton";
import { CarPriceHistoryChart } from "@/components/CarPriceHistoryChart";
import { PriceHistogram } from "@/components/PriceHistogram";
import { PricePredictionBadge } from "@/components/PricePredictionBadge";
import { derivePainted, predictPrice } from "@/lib/price-prediction";
import { getSimilarCars } from "@/lib/recommendations";
import { CarCard } from "@/components/CarCard";
import { serializeCarListItem } from "@/lib/serialize-car-list-item";
import { SourceBadge } from "@/components/SourceBadge";
import { ShareButton } from "@/components/ShareButton";
import { ValuationReportModal } from "@/components/ValuationReportModal";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getMarketMap, segmentKey } from "@/lib/market-price";
import { detectPriceAnomaly } from "@/lib/anomaly";
import { formatNumber, formatPrice, formatRelativeTr } from "@/lib/utils";
import { isLeanCarDoc, serializeCar } from "@/lib/serialize-car";
import { MiniMap } from "@/components/MiniMap";
import { FuelCostCard } from "@/components/FuelCostCard";
import { ListingDescription } from "@/components/ListingDescription";
import { getFuelCostForCar } from "@/lib/fuel-cost-data";
import { resolvePlacement } from "@/lib/district-coords";
import {
  FavoriteOrLogin,
  SellerPhoneNote,
  ViewCounter,
  ViewerOfferBox,
  ViewerQuestions,
  ViewerReportButton,
} from "@/components/ListingViewerIslands";
import { cached, CACHE_TTL } from "@/lib/cache";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { enrichArabamCarIfNeeded } from "@/lib/scraper/enrich-arabam";

/** Fiyat dağılımı için segment fiyatları: önce marka+model, az ise yalnız marka. */
async function loadSegmentPrices(
  brand: string,
  model: string
): Promise<{ label: string; prices: number[] }> {
  const mm = (
    await Car.find({ brand, model, ...PUBLIC_LISTING_FILTER }, { price: 1 }).lean()
  ).map((doc) => doc.price as number);
  if (mm.length >= 5) return { label: `${brand} ${model}`, prices: mm };
  const b = (
    await Car.find({ brand, ...PUBLIC_LISTING_FILTER }, { price: 1 }).lean()
  ).map((doc) => doc.price as number);
  return { label: brand, prices: b };
}

export async function CarDetailBody({ carDoc }: { carDoc: any }) {
  // Arabam ilanıysa ve henüz tüm fotoğrafları / açıklaması çekilmemişse zenginleştir. Vercel'de çalışmaz:
  // Arabam Cloudflare ile yurt dışı sunucuları engelliyor, istek her seferinde boşa 600 ms bekletiyordu.
  if (!process.env.VERCEL) void enrichArabamCarIfNeeded(carDoc).catch(() => {});
  const isInactive = carDoc.status === "removed" || carDoc.status === "sold";
  const status = carDoc.moderationStatus;

  const { brand, model, year, price } = carDoc;


  const carCondition = carDoc.damageFlag
    ? ("damaged" as const)
    : derivePainted(carDoc.paintChange)
    ? ("painted" as const)
    : ("clean" as const);

  const [marketMap, prediction, segment, favoriteCount, fuelCost] = await Promise.all([
    getMarketMap([{ brand, model, year }]),
    cached(
      `predict:${brand}|${model}|${year}|${Math.round(carDoc.mileage / 20000)}|${carCondition}|${carDoc.title.slice(0, 30)}`,
      CACHE_TTL.medium,
      () => predictPrice(brand, model, year, carDoc.mileage, carCondition, carDoc.title)
    ),
    cached(`segment:${brand}|${model}`, CACHE_TTL.medium, () => loadSegmentPrices(brand, model)),
    User.countDocuments({ favorites: carDoc._id }),
    // Yakıt maliyeti hesaplanamazsa (fiyat kaynağına ulaşılamadı, tüketim bilinmiyor) kart gösterilmez.
    getFuelCostForCar(carDoc).catch(() => null),
  ]);

  const targetPrice = prediction?.predictedPrice || price;
  const similarCars = await cached(
    `similar:${brand}|${model}|${Math.round(targetPrice / 50000)}|${carDoc.title.slice(0, 30)}`,
    CACHE_TTL.medium,
    () => getSimilarCars(carDoc._id.toString(), brand, model, price, 12, carDoc.title, carDoc.year, carDoc.mileage, targetPrice)
  );

  const market = marketMap.get(segmentKey(brand, model, year));
  const car = serializeCar(carDoc, market);
  // Hiç yeniden doğrulanmamış ilanda son kontrol, ilanın kaynakta ilk görüldüğü andır.
  const lastChecked = car.lastVerifiedAt || car.createdAt;
  // Derlenen ilanların çoğunda kayıtlı koordinat yok; harita ve "yakınımdaki" ekranlarıyla aynı
  // yaklaşık konum (ilçe, yoksa il merkezi) şehir/adres/açıklamadan hesaplanır.
  const mapPoint = car.location?.lat
    ? { lat: car.location.lat, lng: car.location.lng }
    : resolvePlacement(car.city || "", car.address, 0, car.description);

  /**
   * Üye ilanına özel veriler: ilanı veren kişinin adı ve gelen teklif sayısı.
   * Derlenen (arabam/otomerkezi) ilanlarda karşılığı yok, o yüzden sorgu bile
   * çalıştırılmaz.
   */
  let sellerName = "Üye";
  if (carDoc.sourceSite === "user" && carDoc.ownerId) {
    const owner = await User.findById(carDoc.ownerId).select("name").lean<{ name?: string }>();
    /**
     * GİZLİLİK: ilan sayfası herkese açık. Satıcının tam adı ve telefonu
     * burada dururken teklif/mesaj akışının anlamı kalmaz, üstelik bu
     * bilgiler toplu olarak kazınabilir. Ad maskelenir ("B**** Ş****"),
     * telefon HİÇ gönderilmez — alıcı ancak teklifi KABUL EDİLİNCE
     * sohbette görür (bkz. api/offers/[id] serializeOffer).
     * İşletme adı ticari unvandır, maskelenmez.
     */
    sellerName = carDoc.businessName || maskName(owner?.name || "");
  }

  const segmentLabel = segment.label;
  const segmentPrices = segment.prices;
  const anomaly = detectPriceAnomaly(car.price, segmentPrices);

  const chartData = car.priceHistory.map((point) => ({
    date: new Date(point.recordedAt).toLocaleDateString("tr-TR"),
    price: point.price,
  }));

  const f = car.features;
  const specGroups: { title: string; rows: { label: string; value: string }[] }[] = [
    {
      title: "Genel",
      rows: [
        { label: "Marka", value: car.brand },
        { label: "Model", value: car.model },
        { label: "Yıl", value: String(car.year) },
        { label: "Kilometre", value: `${formatNumber(car.mileage)} km` },
        { label: "Renk", value: f.color },
        { label: "Kasa tipi", value: f.bodyType },
      ],
    },
    {
      title: "Motor & performans",
      rows: [
        f.engineSize ? { label: "Motor hacmi", value: `${f.engineSize} L` } : null,
        f.horsepower ? { label: "Motor gücü", value: `${f.horsepower} HP` } : null,
        f.torque ? { label: "Tork", value: `${f.torque} Nm` } : null,
        f.topSpeed ? { label: "Maksimum hız", value: `${f.topSpeed} km/s` } : null,
        f.acceleration ? { label: "0-100 km/s", value: `${f.acceleration} sn` } : null,
        { label: "Yakıt", value: f.fuelType },
        { label: "Vites", value: f.transmission },
        f.drivetrain ? { label: "Çekiş", value: f.drivetrain } : null,
        f.avgFuelConsumption ? { label: "Ort. yakıt tüketimi", value: f.avgFuelConsumption } : null,
        f.fuelTank ? { label: "Yakıt deposu", value: f.fuelTank } : null,
      ].filter((r): r is { label: string; value: string } => r !== null),
    },
    {
      title: "İlan bilgileri",
      rows: [
        { label: "Konum", value: car.address?.trim() || car.city },
        car.listingDate ? { label: "İlan tarihi", value: car.listingDate } : null,
        car.sellerType ? { label: "Satıcı", value: car.sellerType } : null,
        car.paintChange ? { label: "Boya / değişen", value: car.paintChange } : null,
        { label: "Hasar durumu", value: car.damageFlag ? "Hasar kaydı var" : "Belirtilmemiş" },
        { label: "Görüntülenme", value: formatNumber(car.viewCount || 0) },
        { label: "Favori sayısı", value: formatNumber(favoriteCount) },
      ].filter((r): r is { label: string; value: string } => r !== null),
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <RecentlyViewedTracker carId={car._id} />
      <ViewCounter carId={car._id} />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/" className="text-sm text-amber-300 hover:underline">
          ← Keşfet sayfasına dön
        </Link>
        {isInactive && (
          <span className="text-xs text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
            🚫 Piyasa Arşivi Modu
          </span>
        )}
      </div>

      {/* Arşivdeki / Satılan İlan Uyarısı & Orijinal Link Doğrulama */}
      {isInactive && (
        <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-950/40 via-slate-900/80 to-rose-950/40 p-4 sm:p-5 shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <span className="text-xl">📁</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Piyasa Arşivi: Bu İlan Satılmış veya Yayından Kaldırılmıştır
                </h2>
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300 border border-rose-500/30">
                  Arşiv Kaydı
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-2xl">
                Bu araç orijinal sitede (<strong className="text-rose-200 capitalize">{carDoc.sourceSite}</strong>) yayından kalkmıştır. Fiyat geçmişi, ekspertiz hasar durumu ve teknik özellikleri piyasa analitiği referansı amacıyla görüntülenmektedir.
              </p>
              {carDoc.removedAt && (
                <p className="mt-1 text-[11px] text-rose-200/80">
                  Arşive taşındı: {new Date(carDoc.removedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                  {carDoc.removedReason ? ` — ${carDoc.removedReason}` : ""}
                </p>
              )}
            </div>
          </div>
          {carDoc.listingUrl && (
            <a
              href={carDoc.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 px-4 py-2.5 text-xs font-bold transition shadow-sm"
              title="İlanın orijinal sitede gerçekten kapandığını doğrulamak için aç"
            >
              <span>🔗 Orijinal Kaynakta Doğrula</span>
              <span className="text-[10px]">↗</span>
            </a>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <CarGallery
          images={car.images && car.images.length > 0 ? car.images : [car.imageUrl]}
          title={car.title}
        />

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <SourceBadge source={car.sourceSite} />
            <span className="badge badge-accent">{car.year}</span>
            {car.damageFlag && <span className="badge badge-danger">Hasar İlanı</span>}
            {car.status === "sold" && <span className="badge border-white/20 bg-white/10 text-slate-300">Satıldı</span>}
            {car.status === "removed" && <span className="badge border-rose-500/30 bg-rose-500/20 text-rose-300 font-bold">🚫 Yayından Kaldırıldı / Arşiv</span>}
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">{car.brand}</p>
            <h1 className="text-3xl font-black leading-tight md:text-4xl">{car.title}</h1>
            <p className="mt-2 text-slate-400">
              {car.city} • {formatNumber(car.mileage)} km
            </p>
            {car.status === "active" && car.sourceSite !== "user" && lastChecked && (
              <p
                className="mt-1 text-xs text-emerald-300/80"
                title={new Date(lastChecked).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
              >
                ✓ Kaynakta son kontrol: {formatRelativeTr(lastChecked)}
              </p>
            )}
          </div>

          <p className="text-4xl font-black text-[var(--text)]">{formatPrice(car.price)}</p>

          {car.status === "sold" && (
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <strong>Bu ilan satıldı olarak işaretlendi.</strong> Yeni teklif ya da soru gönderilemez.
            </div>
          )}



          <PricePredictionBadge
            actualPrice={car.price}
            prediction={prediction}
            marketAvgPrice={car.marketAvgPrice}
            marketListingCount={car.marketListingCount}
            marketScope={car.marketScope}
            marketFamilyLabel={car.marketFamilyLabel}
          />


          <div className="flex flex-wrap gap-2">
            <span className="badge">{car.features.fuelType}</span>
            <span className="badge">{car.features.transmission}</span>
            <span className="badge">{car.features.bodyType}</span>
            <span className="badge">{car.features.color}</span>
          </div>

          {fuelCost && <FuelCostCard cost={fuelCost} />}

          <ListingDescription value={car.description} />

          {/* Üye ilanıysa iletişim + işletme rozeti */}
          {car.sourceSite === "user" && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-200">İletişim</span>
                {car.businessName ? (
                  <span className="badge border-amber-400/30 bg-amber-500/15 text-amber-300">
                    İşletme · {car.businessName}
                  </span>
                ) : (
                  <span className="badge">Sahibinden</span>
                )}
                {status === "pending" && (
                  <span className="badge border-amber-400/30 bg-amber-500/15 text-amber-300">
                    Moderasyonda (yalnızca sen görüyorsun)
                  </span>
                )}
              </div>
              <SellerPhoneNote carId={car._id} />
              {/* İlanı veren üye — derlenen ilanlarda böyle bir muhatap yok. */}
              <p className="mt-2 text-xs text-slate-400">
                İlan sahibi: <span className="text-slate-300">{sellerName}</span>
              </p>
            </div>
          )}

          {/* Pazarlık yalnızca ÜYE ilanlarında: derlenen ilanların satıcısı
              sitemizde kayıtlı değil, teklif iletilecek muhatap yok. Satılmış/
              kaldırılmış ilanda da yeni teklif alınmaz (üstteki banner açıklıyor). */}
          {car.sourceSite === "user" && status !== "rejected" && (car.status ?? "active") === "active" && (
            <ViewerOfferBox carId={car._id} listingPrice={car.price} minOffer={car.minOffer || 0} />
          )}

          <div className="flex flex-wrap gap-3">
            <FavoriteOrLogin carId={car._id} />
            <CompareButton carId={car._id} variant="full" />
            <ShareButton title={car.title} />
            <ValuationReportModal
              car={{
                _id: car._id,
                title: car.title,
                brand: car.brand,
                model: car.model,
                year: car.year,
                price: car.price,
                mileage: car.mileage,
                city: car.city,
                address: car.address,
                features: car.features,
                damageFlag: car.damageFlag,
                paintChange: car.paintChange,
                damageParts: car.damageParts,
                marketAvgPrice: car.marketAvgPrice,
                marketListingCount: car.marketListingCount,
                marketFamilyLabel: car.marketScope === "family" ? car.marketFamilyLabel : undefined,
              }}
              predictedPrice={prediction?.predictedPrice}
              comparables={similarCars.map((c) => ({
                _id: c._id,
                title: c.title,
                brand: c.brand,
                model: c.model,
                year: c.year,
                mileage: c.mileage,
                price: c.price,
              }))}
            />
            {car.listingUrl && (
              <a
                href={car.listingUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                Orijinal ilana git
              </a>
            )}
          </div>

          <ViewerReportButton carId={car._id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-5 text-xl font-semibold">Teknik özellikler</h2>
          <div className="space-y-5">
            {specGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300/80">
                  {group.title}
                </p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {group.rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 border-b border-white/5 pb-2"
                    >
                      <dt className="text-sm text-slate-500">{row.label}</dt>
                      <dd className="text-right text-sm font-medium text-slate-100">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}

            {f.safetyFeatures && f.safetyFeatures.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300/80">
                  Güvenlik & donanım
                </p>
                <div className="flex flex-wrap gap-2">
                  {f.safetyFeatures.map((item) => (
                    <span key={item} className="badge">{item}</span>
                  ))}
                </div>
              </div>
            )}

            {f.specSource && (
              <p className="text-[11px] text-slate-600">
                Teknik katalog verisi kaynağı: {f.specSource}
              </p>
            )}
          </div>

          {mapPoint && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm text-slate-500">Konum</h3>
              <MiniMap lat={mapPoint.lat} lng={mapPoint.lng} />
            </div>
          )}
        </div>

        <div className="card space-y-6 p-5">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Fiyat geçmişi</h2>
            <CarPriceHistoryChart data={chartData} />
          </div>
          <PriceHistogram
            prices={segmentPrices}
            currentPrice={car.price}
            segmentLabel={segmentLabel}
            brand={car.brand}
          />
        </div>
      </div>

      {/*
        SORU-CEVAP yalnızca ÜYE ilanlarında görünür (yorumların yerini aldı).
        Derlenen (arabam/otomerkezi) ilanların cevaplayacak bir satıcısı yok —
        eskiden burada bilgilendirme metni gösteriliyordu, kullanıcı bunu
        "mantıksız" buldu (soru sorulamayan bir bölüm neden var?), o yüzden
        artık böyle ilanlarda bölüm HİÇ render edilmiyor. Teknik özelliklerin
        hemen altında — kullanıcı isteği.
      */}
      {status !== "rejected" && car.sourceSite === "user" && (car.status ?? "active") === "active" && (
        <ViewerQuestions carId={car._id} />
      )}

      {/* Hasar/boya görsel özeti — teknik özelliklerin altında, dikkat çeksin. */}
      <DamageDiagram
        paintChange={car.paintChange}
        damageFlag={car.damageFlag}
        damageParts={car.damageParts}
      />


      {similarCars.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Benzer ilanlar</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {similarCars.map((similar) => (
              <CarCard key={similar._id} car={serializeCarListItem(similar)} layout="vertical" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
