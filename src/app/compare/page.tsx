"use client";

import { Suspense, useEffect, useState } from "react";
import { displayTransmission } from "@/lib/transmission-label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Car } from "@/types";
import { formatNumber, formatPrice, formatRelativeTr } from "@/lib/utils";
import { removeFromCompare, subscribeCompare, getCompareIds } from "@/lib/compare-store";
import { CompareAiSummary } from "@/components/CompareAiSummary";
import { CarThumbPlaceholder } from "@/components/CarThumb";
import { FallbackImage } from "@/components/FallbackImage";

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ComparePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Car[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffOnly, setDiffOnly] = useState(false);
  // Kural motorunun "bilinmiyor" bıraktığı donanım öğeleri için AI tahmini (carId -> itemId -> present). Araç başına
  // önbelleklenir (bkz. /api/compare/equipment-ai); tablo önce boşlukla, birkaç saniye sonra doldurularak render olur.
  const [aiGuesses, setAiGuesses] = useState<Record<string, Record<string, boolean>>>({});
  const [aiEquipState, setAiEquipState] = useState<"idle" | "loading" | "done">("idle");

  // URL'de ids yoksa localStorage seçimini kullan
  const idsFromUrl = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function handleRemoveCar(carId: string) {
    removeFromCompare(carId);
    // Tablodan anında çıkararak görsel kilitlenmeyi önle
    setItems((prev) => (prev ? prev.filter((c) => c._id !== carId) : []));

    // URL'deki ?ids= parametresini güncelle
    const urlIds = (searchParams.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== carId);

    if (urlIds.length > 0) {
      router.replace(`/compare?ids=${encodeURIComponent(urlIds.join(","))}`, { scroll: false });
    } else if (searchParams.get("ids")) {
      router.replace("/compare", { scroll: false });
    }
  }

  useEffect(() => {
    const ids = idsFromUrl.length > 0 ? idsFromUrl : getCompareIds();
    if (ids.length < 1) {
      setItems([]);
      return;
    }
    setLoading(true);
    fetch(`/api/compare?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setItems(data.items || []))
      .catch(() => setError("Karşılaştırma verisi alınamadı."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // localStorage seçimi değişirse (araç çıkarılırsa) listeyi güncelle
  useEffect(() => subscribeCompare(() => {
    const storedIds = getCompareIds();
    // Eğer depodan çıkarılmışsa anında tablodan da düşür
    setItems((prev) => (prev ? prev.filter((c) => storedIds.includes(c._id)) : []));
    if (idsFromUrl.length > 0) return; // URL modundaysak fetch atma
    if (storedIds.length < 1) return setItems([]);
    fetch(`/api/compare?ids=${encodeURIComponent(storedIds.join(","))}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const ids = items.map((c) => c._id);
    let active = true;
    setAiEquipState("loading");
    fetch("/api/compare/equipment-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => (r.ok ? r.json() : { guesses: {} }))
      .then((data) => {
        if (active) setAiGuesses(data.guesses || {});
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAiEquipState("done");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items?.map((c) => c._id).join(",")]);

  if (loading) {
    return <p className="py-10 text-center text-slate-400">Karşılaştırma yükleniyor...</p>;
  }

  if (error) {
    return <p className="py-10 text-center text-red-300">{error}</p>;
  }

  if (!items || items.length === 0) {
    return (
      <div className="space-y-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Araç Karşılaştırma</h1>
        <div className="card p-10 text-center text-slate-400">
          Karşılaştırmak için en az 2 araç seç. İlan kartlarındaki{" "}
          <span className="text-amber-300">karşılaştır</span> ikonuna dokunarak araç
          ekleyebilirsin.
          <div className="mt-4">
            <Link href="/" className="btn btn-primary">İlanlara git</Link>
          </div>
        </div>
      </div>
    );
  }

  const prices = items.map((c) => c.price);
  const mileages = items.map((c) => c.mileage);
  const minPrice = Math.min(...prices);
  const minMileage = Math.min(...mileages);
  const maxYear = Math.max(...items.map((c) => c.year));

  // --- Temel Bilgiler Satırları ---
  const basicRows: {
    label: string;
    render: (c: Car) => React.ReactNode;
    best?: (c: Car) => boolean;
    getRawValue?: (c: Car) => unknown;
  }[] = [
    { label: "Fiyat", render: (c) => formatPrice(c.price), best: (c) => c.price === minPrice, getRawValue: (c) => c.price },
    {
      label: "Marka/model/yıl ort.",
      render: (c) =>
        c.marketAvgPrice && (c.marketListingCount ?? 0) >= 3 ? (
          <span className="inline-flex flex-col">
            <span>{formatPrice(c.marketAvgPrice)}</span>
            <small className="text-[10px] font-normal text-slate-500">
              {c.marketListingCount} diğer aktif ilan
              {c.marketScope === "family" && c.marketFamilyLabel ? ` · ${c.marketFamilyLabel} (tüm donanımlar)` : ""}
            </small>
          </span>
        ) : (
          <span className="text-slate-500">
            Yeterli veri yok ({c.marketListingCount ?? 0}/3)
          </span>
        ),
      getRawValue: (c) => c.marketAvgPrice,
    },
    { label: "Yıl", render: (c) => c.year, best: (c) => c.year === maxYear, getRawValue: (c) => c.year },
    {
      label: "Kilometre",
      render: (c) => `${formatNumber(c.mileage)} km`,
      best: (c) => c.mileage === minMileage,
      getRawValue: (c) => c.mileage,
    },
    { label: "Yakıt", render: (c) => c.features.fuelType, getRawValue: (c) => c.features.fuelType },
    { label: "Vites", render: (c) => displayTransmission(c.features.transmission), getRawValue: (c) => c.features.transmission },
    { label: "Kasa", render: (c) => c.features.bodyType, getRawValue: (c) => c.features.bodyType },
    { label: "Renk", render: (c) => c.features.color, getRawValue: (c) => c.features.color },
    { label: "Motor", render: (c) => (c.features.engineSize ? `${c.features.engineSize} L` : "-"), getRawValue: (c) => c.features.engineSize },
    { label: "Güç", render: (c) => (c.features.horsepower ? `${c.features.horsepower} HP` : "-"), getRawValue: (c) => c.features.horsepower },
    { label: "Çekiş", render: (c) => c.features.drivetrain || "-", getRawValue: (c) => c.features.drivetrain },
    { label: "Ort. tüketim", render: (c) => c.features.avgFuelConsumption || "-", getRawValue: (c) => c.features.avgFuelConsumption },
    { label: "Şehir", render: (c) => c.city, getRawValue: (c) => c.city },
    { label: "İlan tarihi", render: (c) => c.listingDate || "-", getRawValue: (c) => c.listingDate },
    {
      label: "Son kontrol",
      render: (c) => {
        const checked = c.lastVerifiedAt || c.createdAt;
        return c.sourceSite === "user" || (c.status && c.status !== "active") || !checked ? "-" : formatRelativeTr(checked);
      },
    },
    {
      label: "Hasar",
      render: (c) =>
        c.damageFlag ? <span className="text-red-400">Hasar kaydı</span> : "Belirtilmemiş",
      getRawValue: (c) => c.damageFlag,
    },
  ];

  // --- Teknik Veri Satırları ---
  // specSource "web" = marka resmi sitesinden beygir gücüyle eşleştirilmiş gerçek veri. "catalog"/"derived" doğrulanmamış,
  // tahminidir (rows aşağıda "~" ile işaretlenir) ve "en iyi" karşılaştırmasına girmez; yalnızca "web" girer.
  const specsOf = (c: Car) => c.technicalSpecs;
  const isVerified = (c: Car) => specsOf(c)?.specSource === "web";
  const accelerations = items.filter(isVerified).map((c) => specsOf(c)?.acceleration).filter((v): v is number => typeof v === "number");
  const topSpeeds = items.filter(isVerified).map((c) => specsOf(c)?.topSpeed).filter((v): v is number => typeof v === "number");
  const torques = items.filter(isVerified).map((c) => specsOf(c)?.torque).filter((v): v is number => typeof v === "number");
  const trunks = items.filter(isVerified).map((c) => specsOf(c)?.trunkCapacity).filter((v): v is number => typeof v === "number");

  const minAcc = accelerations.length > 0 ? Math.min(...accelerations) : undefined;
  const maxSpeed = topSpeeds.length > 0 ? Math.max(...topSpeeds) : undefined;
  const maxTorque = torques.length > 0 ? Math.max(...torques) : undefined;
  const maxTrunk = trunks.length > 0 ? Math.max(...trunks) : undefined;

  // Doğrulanmamış (katalog/tahmin) değer "~" ile işaretlenir, "-" ile gizlenmez (kullanıcı tercihi: boş olmaktansa tahmini göster).
  const specCell = (c: Car, value: number | undefined, unit: string) => {
    if (value === undefined) return "-";
    const text = `${value} ${unit}`;
    return isVerified(c) ? text : <span className="text-slate-500">~{text}</span>;
  };
  const specCellText = (c: Car, text: string | undefined) => {
    if (!text) return "-";
    return isVerified(c) ? text : <span className="text-slate-500">~{text}</span>;
  };

  const techRows: {
    label: string;
    render: (c: Car) => React.ReactNode;
    best?: (c: Car) => boolean;
    getRawValue?: (c: Car) => unknown;
  }[] = [
    {
      label: "0-100 km/s Hızlanma",
      render: (c) => specCell(c, specsOf(c)?.acceleration, "sn"),
      best: (c) => Boolean(isVerified(c) && minAcc !== undefined && specsOf(c)?.acceleration === minAcc),
      getRawValue: (c) => specsOf(c)?.acceleration,
    },
    {
      label: "Azami Hız",
      render: (c) => specCell(c, specsOf(c)?.topSpeed, "km/s"),
      best: (c) => Boolean(isVerified(c) && maxSpeed !== undefined && specsOf(c)?.topSpeed === maxSpeed),
      getRawValue: (c) => specsOf(c)?.topSpeed,
    },
    {
      label: "Maksimum Tork",
      render: (c) => specCell(c, specsOf(c)?.torque, "Nm"),
      best: (c) => Boolean(isVerified(c) && maxTorque !== undefined && specsOf(c)?.torque === maxTorque),
      getRawValue: (c) => specsOf(c)?.torque,
    },
    {
      label: "Bagaj Hacmi",
      render: (c) => specCell(c, specsOf(c)?.trunkCapacity, "L"),
      best: (c) => Boolean(isVerified(c) && maxTrunk !== undefined && specsOf(c)?.trunkCapacity === maxTrunk),
      getRawValue: (c) => specsOf(c)?.trunkCapacity,
    },
    {
      label: "Depo / Batarya",
      render: (c) => specCellText(c, specsOf(c)?.fuelTank),
      getRawValue: (c) => specsOf(c)?.fuelTank,
    },
    {
      label: "Boş Ağırlık",
      render: (c) => specCell(c, specsOf(c)?.curbWeight, "kg"),
      getRawValue: (c) => specsOf(c)?.curbWeight,
    },
  ];

  // --- Donanım Matrisi Kategorileri ---
  // İlk aracın equipmentCategories'inden kategori ve feature şablonunu alıyoruz
  const templateCategories = items[0]?.equipmentCategories || [];

  function isRowSame(getVal: (c: Car) => unknown): boolean {
    if (items!.length < 2) return false;
    const first = getVal(items![0]);
    return items!.every((c) => getVal(c) === first);
  }

  // Donanım durumu: kural motoru "var"/"yok" derse aynen kullanılır. "bilinmiyor" ise AI tahmini (varsa) devreye girer;
  // AI de bilmiyorsa gerçekten bilinmiyor demektir. Eski yanıtta status yoksa yalnızca present'a bakılır.
  const equipmentStatusOf = (c: Car, catId: string, itemId: string): { status: "var" | "yok" | "bilinmiyor"; aiGuessed: boolean } => {
    const item = c.equipmentCategories?.find((ct) => ct.id === catId)?.items.find((i) => i.id === itemId);
    const ruleStatus: "var" | "yok" | "bilinmiyor" = item?.status ?? (item?.present ? "var" : "yok");
    if (ruleStatus !== "bilinmiyor") return { status: ruleStatus, aiGuessed: false };
    const guess = aiGuesses[c._id]?.[itemId];
    if (guess === undefined) return { status: "bilinmiyor", aiGuessed: false };
    return { status: guess ? "var" : "yok", aiGuessed: true };
  };

  const renderBadge = (status: "var" | "yok" | "bilinmiyor", aiGuessed: boolean) => {
    if (status === "bilinmiyor") {
      // Henüz AI yanıtı gelmedi: boşluk yerine soluk "…"; AI yanıt verdi ama bu öğe için tahmin yoksa soluk "–".
      return (
        <span className="inline-flex rounded bg-white/5 px-2 py-0.5 text-xs text-slate-600">
          {aiEquipState === "loading" ? "…" : "–"}
        </span>
      );
    }
    // AI tahmini: aynı rozet, soluk renk ve "~" ön eki ile (ilan/paketten doğrulanmış değerden ayırt edilir, gizlenmez).
    if (status === "var") {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
            aiGuessed ? "bg-emerald-500/5 text-emerald-400/60" : "bg-emerald-500/15 text-emerald-400"
          }`}
        >
          <CheckIcon />
          <span>{aiGuessed ? "~Var" : "Var"}</span>
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
          aiGuessed ? "bg-rose-500/5 text-rose-400/50" : "bg-rose-500/10 text-rose-400/80"
        }`}
      >
        <CrossIcon />
        <span>{aiGuessed ? "~Yok" : "Yok"}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Araç Karşılaştırma</h1>
          <p className="text-xs text-slate-400">
            Temel özellikler, teknik veriler ve donanım matrisi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDiffOnly(!diffOnly)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              diffOnly
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                : "border border-white/10 bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
            }`}
          >
            {diffOnly ? "✓ Sadece Farkları Göster" : "Sadece Farkları Göster"}
          </button>
          <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-slate-400">
            {items.length} araç
          </span>
        </div>
      </div>

      {items.length >= 2 && <CompareAiSummary items={items} />}

      <p className="-mt-3 text-xs leading-relaxed text-slate-500">
        Ortalama, karşılaştırdığın araçlar hariç aktif ilanlardan hesaplanır. Donanım ve kilometre farkları bu ortalamaya dahil değildir; en az 3 ilan yoksa gösterilmez.
      </p>

      <p className="-mt-3 text-xs leading-relaxed text-slate-500">
        Teknik veriler önünde “~” varsa doğrulanmamış tahminidir (marka resmi kaynağı yoksa). “~” olmayan değer marka resmi sitesinden beygir gücüyle eşleştirilmiş gerçek veridir. Donanımda ilan metninden ya da paket kuralından gelen “Var”/“Yok” düz renkli; ilanda hiç geçmeyen ve AI’nın o yıl/pakete göre tahmin ettiği “~Var”/“~Yok” soluk renkli gösterilir. “–” AI’nın da tahmin edemediği, gerçekten bilinmeyen özelliktir.
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur-sm">
        <table className="w-full table-fixed border-collapse sm:min-w-[700px]">
          {/* HEADER ROW WITH VEHICLE CARDS */}
          <thead>
            <tr className="border-b border-white/10 bg-slate-950/40">
              <th className="w-28 p-2 text-left align-bottom text-xs font-semibold text-slate-400 sm:w-44 sm:p-4 sm:text-sm">
                Özellik
              </th>
              {items.map((c) => (
                <th key={c._id} className="p-1 align-bottom sm:p-3">
                  <div className="card overflow-hidden">
                    <Link
                      href={`/cars/${c._id}`}
                      aria-label={`${c.title} ilanına git`}
                      className="relative block aspect-video w-full bg-black/30"
                    >
                      <FallbackImage
                        src={c.imageUrl}
                        fallbacks={c.images}
                        alt={c.title}
                        className="h-full w-full object-cover transition hover:opacity-90"
                        fallback={<CarThumbPlaceholder />}
                      />
                    </Link>
                    <div className="space-y-0.5 p-2 text-left sm:space-y-1 sm:p-3">
                      <Link
                        href={`/cars/${c._id}`}
                        className="break-words text-[11px] font-semibold leading-snug hover:text-amber-300 sm:text-sm"
                      >
                        {c.title}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveCar(c._id)}
                        className="text-xs text-slate-500 transition hover:text-red-400"
                      >
                        Çıkar
                      </button>
                    </div>
                  </div>
                </th>
              ))}
              {items.length === 1 && (
                <th className="p-1 align-bottom sm:p-3">
                  <Link
                    href="/"
                    className="flex min-h-[14rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-400/50 bg-amber-400/5 p-4 text-center transition hover:bg-amber-400/10"
                  >
                    <span className="text-2xl leading-none text-amber-300" aria-hidden>
                      +
                    </span>
                    <span className="text-sm font-semibold text-amber-200">Sağ tarafa bir araç daha ekle</span>
                    <span className="text-xs text-slate-400">
                      Karşılaştırmak için en az 2 araç gerekli. İlan kartındaki karşılaştır ikonuna dokun.
                    </span>
                  </Link>
                </th>
              )}
            </tr>
          </thead>

          {/* SECTION 1: TEMEL BİLGİLER */}
          <tbody>
            <tr className="bg-slate-800/60">
              <td
                colSpan={items.length + (items.length === 1 ? 2 : 1)}
                className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-400 sm:px-4"
              >
                📌 Genel İlan & Araç Bilgileri
              </td>
            </tr>
            {basicRows
              .filter((row) => !diffOnly || !row.getRawValue || !isRowSame(row.getRawValue))
              .map((row) => (
                <tr key={row.label} className="border-t border-white/5 transition hover:bg-white/[0.02]">
                  <td className="p-2 text-xs leading-tight text-slate-400 sm:p-3.5 sm:text-sm">
                    {row.label}
                  </td>
                  {items.map((c) => {
                    const isBest = items.length >= 2 && row.best?.(c);
                    return (
                      <td
                        key={c._id}
                        className={`break-words p-2 text-xs font-medium sm:p-3.5 sm:text-sm ${
                          isBest ? "bg-emerald-500/10 text-emerald-300 sm:bg-transparent" : "text-slate-100"
                        }`}
                      >
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {row.render(c)}
                          {isBest && (
                            <span className="hidden rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300 sm:inline">
                              en iyi
                            </span>
                          )}
                        </span>
                      </td>
                    );
                  })}
                  {items.length === 1 && <td className="p-2 sm:p-3.5" aria-hidden />}
                </tr>
              ))}
          </tbody>

          {/* SECTION 2: TEKNİK VERİLER */}
          <tbody>
            <tr className="bg-slate-800/60">
              <td
                colSpan={items.length + (items.length === 1 ? 2 : 1)}
                className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-sky-400 sm:px-4"
              >
                ⚡ Teknik Veriler (Performans & Kapasite)
              </td>
            </tr>
            {techRows
              .filter((row) => !diffOnly || !row.getRawValue || !isRowSame(row.getRawValue))
              .map((row) => (
                <tr key={row.label} className="border-t border-white/5 transition hover:bg-white/[0.02]">
                  <td className="p-2 text-xs leading-tight text-slate-400 sm:p-3.5 sm:text-sm">
                    {row.label}
                  </td>
                  {items.map((c) => {
                    const isBest = items.length >= 2 && row.best?.(c);
                    return (
                      <td
                        key={c._id}
                        className={`break-words p-2 text-xs font-medium sm:p-3.5 sm:text-sm ${
                          isBest ? "bg-emerald-500/10 text-emerald-300 sm:bg-transparent" : "text-slate-100"
                        }`}
                      >
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {row.render(c)}
                          {isBest && (
                            <span className="hidden rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300 sm:inline">
                              en iyi
                            </span>
                          )}
                        </span>
                      </td>
                    );
                  })}
                  {items.length === 1 && <td className="p-2 sm:p-3.5" aria-hidden />}
                </tr>
              ))}
          </tbody>

          {/* SECTION 3..6: DONANIM KATEGORİLERİ */}
          {templateCategories.map((cat) => {
            const getCatIcon = () => {
              switch (cat.id) {
                case "safety":
                  return "🛡️";
                case "comfort":
                  return "🛋️";
                case "exterior":
                  return "🚗";
                case "multimedia":
                  return "📱";
                default:
                  return "✨";
              }
            };

            const filteredItems = cat.items.filter((itemDef) => {
              if (!diffOnly) return true;
              return !isRowSame((c) => equipmentStatusOf(c, cat.id, itemDef.id).status);
            });

            if (filteredItems.length === 0) return null;

            return (
              <tbody key={cat.id}>
                <tr className="bg-slate-800/60">
                  <td
                    colSpan={items.length + (items.length === 1 ? 2 : 1)}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-400 sm:px-4"
                  >
                    {getCatIcon()} {cat.title}
                  </td>
                </tr>
                {filteredItems.map((itemDef) => (
                  <tr key={itemDef.id} className="border-t border-white/5 transition hover:bg-white/[0.02]">
                    <td className="p-2 text-xs leading-tight text-slate-400 sm:p-3.5 sm:text-sm">
                      {itemDef.name}
                    </td>
                    {items.map((c) => {
                      const { status, aiGuessed } = equipmentStatusOf(c, cat.id, itemDef.id);
                      return (
                        <td key={c._id} className="p-2 align-middle sm:p-3.5">
                          {renderBadge(status, aiGuessed)}
                        </td>
                      );
                    })}
                    {items.length === 1 && <td className="p-2 sm:p-3.5" aria-hidden />}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-slate-400">Yükleniyor...</p>}>
      <ComparePageInner />
    </Suspense>
  );
}
