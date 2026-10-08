"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatPrice } from "@/lib/utils";
import { Icon } from "@/components/Icon";

type Condition = "clean" | "painted" | "damaged";

interface YearlyPoint {
  year: number;
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgMileage: number;
  cars?: Array<{ _id: string; title: string; price: number; mileage: number; city?: string }>;
}

interface Effects {
  annualLossPct: number | null;
  per10kKmLossPct: number | null;
  typicalAnnualLossPct: number | null;
  damagePct: number | null;
  paintPct: number | null;
  sample: number;
  r2: number | null;
}

interface Breakdown {
  brand: string;
  model: string;
  count: number;
  totalBeforeFilters: number;
  yearlyData: YearlyPoint[];
  mileageData: Array<{ range: string; count: number; avgPrice: number }>;
  conditionCurves: Array<{ year: number; clean?: number; painted?: number; damaged?: number }>;
  conditionCounts: Record<Condition, number>;
  effects: Effects | null;
  stats: { overallAvgPrice: number } | null;
  brands: string[];
  brandModels: Record<string, string[]>;
}

const CONDITIONS: Array<{ key: "all" | Condition; label: string; color: string }> = [
  { key: "all", label: "Tümü", color: "#8f8d86" },
  { key: "clean", label: "Hasarsız", color: "#34d399" },
  { key: "painted", label: "Boyalı / değişen", color: "#f2b544" },
  { key: "damaged", label: "Hasar kayıtlı", color: "#f87171" },
];

const KM_RANGES: Array<{ label: string; min?: number; max?: number }> = [
  { label: "Tüm km" },
  { label: "0–50 bin", max: 50_000 },
  { label: "50–100 bin", min: 50_000, max: 100_000 },
  { label: "100–150 bin", min: 100_000, max: 150_000 },
  { label: "150 bin+", min: 150_000 },
];

const axisPrice = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(".", ",")}M` : v >= 1000 ? `${Math.round(v / 1000)}B` : String(v));
const pct = (v: number | null, signed = false) =>
  v === null ? "—" : `${v < 0 ? "−" : signed && v > 0 ? "+" : ""}%${Math.abs(v).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;

export function DegerKaybi() {
  const [brands, setBrands] = useState<string[]>([]);
  const [brandModels, setBrandModels] = useState<Record<string, string[]>>({});
  const [brand, setBrand] = useState("Renault");
  const [model, setModel] = useState("Megane");
  const [condition, setCondition] = useState<"all" | Condition>("all");
  const [kmIndex, setKmIndex] = useState(0);
  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);

  // Marka ve model listesi (bir kez; varsayılan Renault Megane, yoksa ilk marka)
  useEffect(() => {
    fetch("/api/analytics/model-breakdown")
      .then((r) => r.json())
      .then((res) => {
        if (!res.brands?.length) return;
        setBrands(res.brands);
        setBrandModels(res.brandModels || {});
        const b = res.brands.includes("Renault") ? "Renault" : res.brands[0];
        const models: string[] = res.brandModels?.[b] || [];
        setBrand(b);
        setModel(models.includes("Megane") ? "Megane" : models[0] || "");
      })
      .catch(() => setError("Marka listesi alınamadı."));
  }, []);

  const load = useCallback(() => {
    if (!brand || !model) return () => {};
    let alive = true;
    const range = KM_RANGES[kmIndex];
    const params = new URLSearchParams({ brand, model });
    if (condition !== "all") params.set("hasar", condition);
    if (range.min) params.set("kmMin", String(range.min));
    if (range.max) params.set("kmMax", String(range.max));
    setLoading(true);
    setError(null);
    fetch(`/api/analytics/model-breakdown?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 429 ? "Çok sık istek: bir dakika sonra yeniden dene." : "Analiz verisi alınamadı.");
        return r.json();
      })
      .then((res: Breakdown) => {
        if (!alive) return;
        setData(res);
        const years = [...(res.yearlyData || [])].sort((a, b) => b.count - a.count);
        setActiveYear(years[0]?.year ?? null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Hata oluştu"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [brand, model, condition, kmIndex]);

  useEffect(() => load(), [load]);

  const models = brandModels[brand] || [];
  const effects = data?.effects ?? null;
  const yearly = useMemo(() => [...(data?.yearlyData || [])].sort((a, b) => a.year - b.year), [data]);
  const active = yearly.find((y) => y.year === activeYear) ?? null;
  const visibleSeries = CONDITIONS.filter((c) => c.key !== "all" && (condition === "all" || condition === c.key));

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="dk-brand">Marka</label>
            <select
              id="dk-brand"
              className="select"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setModel((brandModels[e.target.value] || [])[0] || "");
              }}
            >
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dk-model">Model</label>
            <select id="dk-model" className="select" value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="label">Hasar durumu</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Hasar durumu">
              {CONDITIONS.map((c) => {
                const n = c.key === "all" ? data?.totalBeforeFilters : data?.conditionCounts?.[c.key];
                return (
                  <button key={c.key} type="button" onClick={() => setCondition(c.key)} className={`chip ${condition === c.key ? "chip-active" : ""}`} aria-pressed={condition === c.key}>
                    {c.key !== "all" && <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />}
                    {c.label}
                    {n !== undefined && <span className="num text-[0.72rem] opacity-60">{formatNumber(n)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="label">Kilometre</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Kilometre aralığı">
              {KM_RANGES.map((r, i) => (
                <button key={r.label} type="button" onClick={() => setKmIndex(i)} className={`chip ${kmIndex === i ? "chip-active" : ""}`} aria-pressed={kmIndex === i}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="card border-[var(--danger)] p-4 text-[var(--danger)]">{error}</div>}

      {data && data.count === 0 && !loading && (
        <div className="card p-8 text-center text-[var(--muted)]">Bu süzgeçlerle eşleşen ilan yok. Süzgeçleri gevşetmeyi dene.</div>
      )}

      {data && data.count > 0 && (
        <>
          <section aria-label="Etkiler" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Yaşın etkisi" value={pct(effects?.annualLossPct ?? null)} note="her ek yıl, aynı km ve durumda" tone="accent" />
            <Kpi label="Pratikte yıllık" value={pct(effects?.typicalAnnualLossPct ?? null)} note="yaş + yılda ~15 bin km" tone="accent" />
            <Kpi label="10 bin km" value={pct(effects?.per10kKmLossPct ?? null)} note="aynı yaşta her 10.000 km" tone="km" />
            <Kpi label="Hasar kayıtlı" value={pct(effects?.damagePct ?? null, true)} note="hasarsıza göre fiyat farkı" tone="danger" />
            <Kpi label="Boyalı / değişen" value={pct(effects?.paintPct ?? null, true)} note="hasarsıza göre fiyat farkı" tone="paint" />
          </section>
          <p className="-mt-3 text-xs text-[var(--muted)]">
            {effects && effects.sample >= 15
              ? `${formatNumber(effects.sample)} ilanın fiyatı yaş, kilometre ve hasar durumuna birlikte bağlanarak hesaplandı (açıklama gücü R² = ${effects.r2?.toLocaleString("tr-TR") ?? "—"}); her etki diğerlerinden arındırılmıştır. "—" gösterilen etki için yeterli ilan yok.`
              : "Etkileri güvenilir hesaplamak için bu süzgeçlerde yeterli ilan yok (en az 15)."}
          </p>

          <section className="card space-y-3 p-4 sm:p-5">
            <div>
              <p className="eyebrow">Değer kaybı eğrisi</p>
              <h2 className="font-display text-xl font-semibold">Model yılına göre ortalama fiyat</h2>
              <p className="text-sm text-[var(--muted)]">Her seri, o durumdaki ilanların ortalaması (bir yılda en az 2 ilan olan noktalar).</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <LineChart data={data.conditionCurves} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(143,141,134,0.18)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: "#8f8d86", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={axisPrice} tick={{ fill: "#8f8d86", fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    formatter={(value, name) => [formatPrice(Number(value)), String(name)]}
                    labelFormatter={(label) => `${label} model`}
                    contentStyle={{ background: "#1a1d23", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#f2f1ec" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  {visibleSeries.map((c) => (
                    <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card space-y-3 p-4 sm:p-5">
            <div>
              <p className="eyebrow">Model yılı</p>
              <h2 className="font-display text-xl font-semibold">Yıla göre ilanlar</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Model yılı">
              {yearly.map((y) => (
                <button key={y.year} type="button" onClick={() => setActiveYear(y.year)} className={`chip ${activeYear === y.year ? "chip-active" : ""}`} aria-pressed={activeYear === y.year}>
                  {y.year} <span className="num text-[0.72rem] opacity-60">{y.count}</span>
                </button>
              ))}
            </div>
            {active && (
              <div className="surface-2 space-y-3 p-4">
                <p className="text-sm text-[var(--muted)]">
                  <span className="font-display text-base font-semibold text-[var(--text)]">{active.year} model {brand} {model}</span>
                  {" · "}ortalama <span className="num text-[var(--text)]">{formatPrice(active.avgPrice)}</span>
                  {" · "}<span className="num">{formatPrice(active.minPrice)} – {formatPrice(active.maxPrice)}</span>
                  {" · "}ort. <span className="num">{formatNumber(active.avgMileage)} km</span>
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {(active.cars || []).map((c) => (
                    <li key={c._id}>
                      <Link href={`/cars/${c._id}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 transition hover:border-[var(--border-strong)]">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{c.title}</span>
                          <span className="num text-xs text-[var(--muted)]">{formatNumber(c.mileage)} km{c.city ? ` · ${c.city}` : ""}</span>
                        </span>
                        <span className="num shrink-0 text-sm font-semibold text-[var(--accent)]">{formatPrice(c.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={`/?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&yearMin=${active.year}&yearMax=${active.year}`} className="btn btn-secondary text-sm">
                  Tüm {active.year} ilanlarını gör
                  <Icon name="arrowRight" size={15} />
                </Link>
              </div>
            )}
          </section>

          <section className="card space-y-3 p-4 sm:p-5">
            <div>
              <p className="eyebrow">Kilometre</p>
              <h2 className="font-display text-xl font-semibold">Kilometreye göre ortalama fiyat</h2>
              <p className="text-sm text-[var(--muted)]">Kilometre arttıkça fiyatın nasıl düştüğü (seçili hasar durumu için).</p>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer>
                <BarChart data={data.mileageData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(143,141,134,0.18)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fill: "#8f8d86", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={axisPrice} tick={{ fill: "#8f8d86", fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    formatter={(value, _n, item) => [`${formatPrice(Number(value))} · ${(item?.payload as { count?: number })?.count ?? 0} ilan`, "Ortalama"]}
                    contentStyle={{ background: "#1a1d23", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#f2f1ec" }}
                  />
                  <Bar dataKey="avgPrice" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}

      {loading && !data && <div className="card p-10 text-center text-[var(--muted)]">Yükleniyor…</div>}
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone: "accent" | "km" | "danger" | "paint" }) {
  const color = { accent: "var(--accent)", km: "var(--fair)", danger: "var(--danger)", paint: "#f2b544" }[tone];
  return (
    <div className="card border-l-4 p-3.5" style={{ borderLeftColor: color }}>
      <p className="eyebrow !text-[0.64rem]">{label}</p>
      <p className="num mt-1.5 text-2xl font-semibold" style={{ color: value === "—" ? "var(--faint)" : color }}>
        {value}
      </p>
      <p className="mt-1 text-[0.78rem] leading-snug text-[var(--muted)]">{note}</p>
    </div>
  );
}
