import Link from "next/link";
import { notFound } from "next/navigation";
import { User } from "@/models/User";
import { Offer } from "@/models/Offer";
import { OfferBox } from "@/components/OfferBox";
import { maskName } from "@/lib/form-options";
import { QuestionsSection } from "@/components/QuestionsSection";
import { DamageDiagram } from "@/components/DamageDiagram";
import { CarGallery } from "@/components/CarGallery";
import { RecentlyViewedTracker } from "@/components/RecentlyViewedTracker";
import { LiveMarketBadge } from "@/components/LiveMarketBadge";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CompareButton } from "@/components/CompareButton";
import { CarPriceHistoryChart } from "@/components/CarPriceHistoryChart";
import { PriceHistogram } from "@/components/PriceHistogram";
import { MarketPriceBadge } from "@/components/MarketPriceBadge";
import { PricePredictionBadge } from "@/components/PricePredictionBadge";
import { predictPrice } from "@/lib/price-prediction";
import { getSimilarCars } from "@/lib/recommendations";
import { CarCard } from "@/components/CarCard";
import { SourceBadge } from "@/components/SourceBadge";
import { ShareButton } from "@/components/ShareButton";
import { ReportListingButton } from "@/components/ReportListingButton";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getMarketMap, segmentKey } from "@/lib/market-price";
import { detectPriceAnomaly } from "@/lib/anomaly";
import { formatNumber, formatPrice } from "@/lib/utils";
import { isLeanCarDoc, serializeCar } from "@/lib/serialize-car";
import { MiniMap } from "@/components/MiniMap";
import { getCurrentUser } from "@/lib/auth";
import { cached, CACHE_TTL } from "@/lib/cache";

interface CarDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Fiyat dağılımı için segment fiyatları: önce marka+model, az ise yalnız marka. */
async function loadSegmentPrices(
  brand: string,
  model: string
): Promise<{ label: string; prices: number[] }> {
  const mm = (
    await Car.find({ brand, model }, { price: 1 }).lean()
  ).map((doc) => doc.price as number);
  if (mm.length >= 5) return { label: `${brand} ${model}`, prices: mm };
  const b = (await Car.find({ brand }, { price: 1 }).lean()).map((doc) => doc.price as number);
  return { label: brand, prices: b };
}

export default async function CarDetailPage({ params }: CarDetailPageProps) {
  const viewer = await getCurrentUser();
  const { id } = await params;

  try {
    await connectDB();
  } catch {
    notFound();
  }

  const carDoc = await Car.findById(id).lean();
  if (!isLeanCarDoc(carDoc)) notFound();

  // Bekleyen/reddedilen üye ilanı yalnızca SAHİBİ ya da admin görebilir —
  // moderasyondan geçmemiş ilan herkese açık link ile bile gösterilmesin.
  const status = carDoc.moderationStatus;
  if (status === "pending" || status === "rejected") {
    const isOwner = viewer && carDoc.ownerId && carDoc.ownerId.toString() === viewer.userId;
    const isAdmin = viewer?.role === "admin";
    if (!isOwner && !isAdmin) notFound();
  }

  const { brand, model, year, price } = carDoc;

  // Sahibi kendi ilanına bakarken görüntülenme sayısı artmasın.
  const ownerViewing = !!viewer && !!carDoc.ownerId && carDoc.ownerId.toString() === viewer.userId;

  // PARALEL + ÖNBELLEK: Bu sorgular birbirinden bağımsız. Eskiden art arda
  // (await await await) çalışıyordu → canlıda (Atlas M0) her biri ayrı bekleme,
  // toplam 5-6 sn. Artık aynı anda çalışıyor (≈en yavaşı kadar) ve segment bazlı
  // önbellekle aynı marka/model tekrar açılınca anında geliyor.
  const [marketMap, prediction, similarCars, segment, , favoriteCount] = await Promise.all([
    getMarketMap([{ brand, model, year }]),
    cached(
      `predict:${brand}|${model}|${year}|${Math.round(carDoc.mileage / 20000)}`,
      CACHE_TTL.medium,
      () => predictPrice(brand, model, year, carDoc.mileage)
    ),
    cached(
      `similar:${brand}|${model}|${Math.round(price / 100000)}`,
      CACHE_TTL.medium,
      () => getSimilarCars(carDoc._id.toString(), brand, model, price)
    ),
    cached(`segment:${brand}|${model}`, CACHE_TTL.medium, () => loadSegmentPrices(brand, model)),
    ownerViewing ? Promise.resolve(null) : Car.updateOne({ _id: carDoc._id }, { $inc: { viewCount: 1 } }),
    User.countDocuments({ favorites: carDoc._id }),
  ]);

  const market = marketMap.get(segmentKey(brand, model, year));
  const car = serializeCar(carDoc, market);

  /**
   * Üye ilanına özel veriler: ilanı veren kişinin adı ve gelen teklif sayısı.
   * Derlenen (arabam/otomerkezi) ilanlarda karşılığı yok, o yüzden sorgu bile
   * çalıştırılmaz.
   */
  const isOwner = ownerViewing;
  let sellerName = "Üye";
  let offerCount = 0;
  if (carDoc.sourceSite === "user" && carDoc.ownerId) {
    const [owner, count] = await Promise.all([
      User.findById(carDoc.ownerId).select("name").lean<{ name?: string }>(),
      isOwner ? Offer.countDocuments({ car: carDoc._id }) : Promise.resolve(0),
    ]);
    /**
     * GİZLİLİK: ilan sayfası herkese açık. Satıcının tam adı ve telefonu
     * burada dururken teklif/mesaj akışının anlamı kalmaz, üstelik bu
     * bilgiler toplu olarak kazınabilir. Ad maskelenir ("B**** Ş****"),
     * telefon HİÇ gönderilmez — alıcı ancak teklifi KABUL EDİLİNCE
     * sohbette görür (bkz. api/offers/[id] serializeOffer).
     * İşletme adı ticari unvandır, maskelenmez.
     */
    sellerName = carDoc.businessName || maskName(owner?.name || "");
    offerCount = count;
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
      <Link href="/" className="text-sm text-amber-300 hover:underline">
        ← Keşfet sayfasına dön
      </Link>

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
            {car.status === "removed" && (
              <span className="badge border-white/20 bg-white/10 text-slate-400">Kaynaktan kaldırıldı</span>
            )}
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">{car.brand}</p>
            <h1 className="text-3xl font-black leading-tight md:text-4xl">{car.title}</h1>
            <p className="mt-2 text-slate-400">
              {car.city} • {formatNumber(car.mileage)} km
            </p>
          </div>

          <p className="text-4xl font-black text-[var(--text)]">{formatPrice(car.price)}</p>

          {car.status === "sold" && (
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <strong>Bu ilan satıldı olarak işaretlendi.</strong> Yeni teklif ya da soru gönderilemez.
            </div>
          )}
          {car.status === "removed" && (
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <strong>Bu ilan artık kaynak sitede bulunamıyor</strong> (satılmış ya da kaldırılmış olabilir).
              Bilgiler son taramadaki hâliyle gösteriliyor.
            </div>
          )}

          <LiveMarketBadge brand={car.brand} model={car.model} price={car.price} />

          <MarketPriceBadge
            price={car.price}
            marketAvgPrice={car.marketAvgPrice}
            marketListingCount={car.marketListingCount}
          />

          <PricePredictionBadge actualPrice={car.price} prediction={prediction} />

          {anomaly?.label === "ucuz" && (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <strong>⚡ İstatistiksel fırsat:</strong> Bu ilan, {segmentLabel}{" "}
              segmentindeki {anomaly.sampleCount} emsalin ortalamasının{" "}
              <strong>%{Math.abs(anomaly.pctFromMean)} altında</strong> (z-skoru{" "}
              {anomaly.z}). Fırsat olabilir — yine de düşük fiyatın nedenini
              (hasar, km, acil satış) kontrol et.
            </div>
          )}
          {anomaly?.label === "pahali" && (
            <div className="rounded-xl border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
              <strong>📈 Piyasa üstü fiyat:</strong> Bu ilan, {segmentLabel}{" "}
              segmentindeki {anomaly.sampleCount} emsalin ortalamasının{" "}
              <strong>%{anomaly.pctFromMean} üzerinde</strong> (z-skoru {anomaly.z}).
              Pazarlık payı olabilir.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <span className="badge">{car.features.fuelType}</span>
            <span className="badge">{car.features.transmission}</span>
            <span className="badge">{car.features.bodyType}</span>
            <span className="badge">{car.features.color}</span>
          </div>

          <p className="leading-7 text-slate-300">{car.description}</p>

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
              {isOwner && car.contactPhone ? (
                <a href={`tel:${car.contactPhone.replace(/\s/g, "")}`} className="text-lg font-black text-[var(--text)] hover:text-amber-300">
                  📞 {car.contactPhone}
                  <span className="ml-2 align-middle text-xs font-normal text-slate-400">
                    (yalnızca sen görüyorsun)
                  </span>
                </a>
              ) : (
                <p className="text-sm text-slate-300">
                  Telefon numarası gizli. Teklifin <strong>kabul edilirse</strong> satıcının
                  numarasını sohbette görebilirsin.
                </p>
              )}
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
            <OfferBox
              carId={car._id}
              listingPrice={car.price}
              minOffer={car.minOffer || 0}
              isOwner={isOwner}
              loggedIn={!!viewer}
              offerCount={offerCount}
            />
          )}

          <div className="flex flex-wrap gap-3">
            {viewer ? (
              <FavoriteButton carId={car._id} />
            ) : (
              <Link href={`/login?next=/cars/${car._id}`} className="btn btn-secondary">
                ♡ Favori için giriş yap
              </Link>
            )}
            <CompareButton carId={car._id} variant="full" />
            <ShareButton title={car.title} />
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

          <ReportListingButton carId={car._id} loggedIn={!!viewer} />
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

          {car.location && car.location.lat && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm text-slate-500">Konum</h3>
              <MiniMap lat={car.location.lat} lng={car.location.lng} />
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
        <QuestionsSection carId={car._id} isOwner={isOwner} loggedIn={!!viewer} />
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
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {similarCars.map((similar) => (
              <CarCard key={similar._id} car={similar} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
