import type { FuelCost } from "@/lib/fuel-cost";

const tl = (n: number, digits = 2) => n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** İlanın km başına yakıt maliyeti: resmi tüketim × ilanın ilindeki güncel pompa fiyatı. */
export function FuelCostCard({ cost }: { cost: FuelCost }) {
  const tone =
    cost.rating === "low"
      ? "border-emerald-400/30 bg-emerald-500/5"
      : cost.rating === "high"
        ? "border-orange-400/30 bg-orange-500/5"
        : "border-white/10 bg-white/[0.03]";
  const date = new Date(cost.priceDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });

  return (
    <section className={`rounded-2xl border p-4 ${tone}`} aria-label="Yakıt maliyeti">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">⛽ Yakıt maliyeti</h3>
        <span className="text-xs text-slate-500">
          {cost.place} pompa fiyatı · {cost.priceSource} · {date}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-1">
        <p>
          <span className="text-2xl font-black text-amber-300">{tl(cost.perKm)} ₺</span>
          <span className="ml-1 text-sm text-slate-400">/ km</span>
        </p>
        <p className="text-sm text-slate-300">
          100 km: <strong>{tl(cost.per100Km, 0)} ₺</strong>
        </p>
        {cost.petrolPer100Km !== undefined && (
          <p className="text-sm text-slate-400">Benzinle 100 km: {tl(cost.petrolPer100Km, 0)} ₺</p>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Resmi ortalama tüketim {cost.consumption.toLocaleString("tr-TR")} lt/100 km
        {cost.consumptionSource === "model" ? ` (${cost.consumptionNote || "aynı modelin resmi değeri"})` : ""} × {cost.priceFuel}{" "}
        {tl(cost.pricePerLiter)} ₺/lt
        {cost.priceFuel === "LPG" ? " (LPG'de tüketim ~%20 fazla hesaplandı)" : ""}.
      </p>
      {cost.ratingText && (
        <p className={`mt-2 text-sm font-semibold ${cost.rating === "low" ? "text-emerald-300" : "text-orange-300"}`}>
          {cost.rating === "low" ? "✅ " : "⚠️ "}
          {cost.ratingText}
        </p>
      )}
      {cost.note && <p className="mt-2 text-xs text-slate-400">ℹ️ {cost.note}</p>}
    </section>
  );
}
