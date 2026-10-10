import type { FuelCost } from "@/lib/fuel-cost";

const tl = (n: number, digits = 2) => n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** İlanın km başına yakıt maliyeti: ilan, emsal veya tahmini tüketim × ilindeki güncel pompa fiyatı. */
export function FuelCostCard({ cost }: { cost: FuelCost }) {
  const tone =
    cost.rating === "low"
      ? "border-emerald-400/30 bg-emerald-500/5"
      : cost.rating === "high"
        ? "border-orange-400/30 bg-orange-500/5"
        : "border-white/10 bg-white/[0.03]";
  // Sunucuda UTC çalışır; fiyatın saati her yerde Türkiye saatiyle yazılsın.
  const date = new Date(cost.priceDate).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
  const plug = cost.plugIn;
  const electric = cost.electric;
  const consumptionLabel = cost.consumptionSource === "ilan"
    ? "İlan sayfasındaki ortalama tüketim"
    : cost.consumptionSource === "model"
      ? "Emsal araçların tüketim medyanı"
      : "Tahmini ortalama tüketim";

  return (
    <section className={`rounded-2xl border p-4 ${tone}`} aria-label="Yakıt maliyeti">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="eyebrow">Yakıt maliyeti</h3>
        <span className="text-xs text-slate-500">
          {electric ? "Tahmini elektrik tarifesi" : `${cost.place} pompa fiyatı · ${cost.priceSource} · ${date}`}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-1">
        <p>
          <span className="text-2xl font-black text-amber-300">{tl(cost.perKm)} ₺</span>
          <span className="ml-1 text-sm text-slate-400">/ km{plug || electric ? " (evde şarjla)" : ""}</span>
        </p>
        <p className="text-sm text-slate-300">
          100 km: <strong>{tl(cost.per100Km, 0)} ₺</strong>
        </p>
        {cost.petrolPer100Km !== undefined && (
          <p className="text-sm text-slate-400">Benzinle 100 km: {tl(cost.petrolPer100Km, 0)} ₺</p>
        )}
      </div>
      {electric ? (
        <>
          <p className="mt-2 text-sm text-slate-300">
            Halka açık şarjla <strong>{tl(electric.perKmPublicCharge)} ₺/km</strong>
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {electric.kwhPer100} kWh/100 km × {tl(electric.homePricePerKwh, 1)} ₺/kWh (ev) = {tl(cost.per100Km, 0)} ₺. Halka açık AC şarj ~
            {tl(electric.publicPricePerKwh, 1)} ₺/kWh alındı.
          </p>
          <p className="mt-2 text-xs text-slate-500">{cost.note}</p>
        </>
      ) : plug ? (
        <>
          <p className="mt-2 text-sm text-slate-300">
            Halka açık şarjla <strong>{tl(plug.perKmPublicCharge)} ₺/km</strong>
            {plug.perKmEmptyBattery !== undefined && (
              <>
                {" · "}Şarj bitince benzinli gibi <strong>{tl(plug.perKmEmptyBattery)} ₺/km</strong>
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Benzin: {consumptionLabel.toLocaleLowerCase("tr-TR")} {cost.consumption.toLocaleString("tr-TR")} lt/100 km
            {cost.consumptionNote ? ` (${cost.consumptionNote})` : ""} × {cost.priceFuel} {tl(cost.pricePerLiter)} ₺/lt ={" "}
            {tl(plug.fuelPer100Km, 0)} ₺. Elektrik: {plug.electricKwhPer100} kWh/100 km × {tl(plug.homePricePerKwh, 1)} ₺/kWh (ev) ={" "}
            {tl(plug.electricPer100Km, 0)} ₺. Halka açık AC şarj ~{tl(plug.publicPricePerKwh, 1)} ₺/kWh alındı.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {cost.note} Elektrik fiyatları tahminidir ({plug.electricityReviewed} itibarıyla), pompa fiyatı gibi günlük güncellenmez.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-400">
            {consumptionLabel} {cost.consumption.toLocaleString("tr-TR")} lt/100 km
            {cost.consumptionNote ? ` (${cost.consumptionNote})` : ""} × {cost.priceFuel}{" "}
            {tl(cost.pricePerLiter)} ₺/lt
            {cost.priceFuel === "LPG" ? " (LPG'de tüketim ~%20 fazla hesaplandı)" : ""}.
          </p>
          {cost.ratingText && (
            <p className={`mt-2 text-sm font-semibold ${cost.rating === "low" ? "text-emerald-300" : "text-orange-300"}`}>
              {cost.ratingText}
            </p>
          )}
          {cost.note && <p className="mt-2 text-xs text-slate-400">{cost.note}</p>}
        </>
      )}
    </section>
  );
}
