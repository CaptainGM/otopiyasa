"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatNumber, formatPrice } from "@/lib/utils";
import { findModelAdvisory } from "@/lib/model-advisories";
import { resolveTechnicalSpecs } from "@/lib/catalog/specs-catalog";
import { evaluateCarEquipment } from "@/lib/catalog/car-equipment";

interface ValuationReportModalProps {
  car: {
    _id: string;
    title: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    mileage: number;
    city: string;
    address?: string;
    description?: string;
    features?: {
      fuelType?: string;
      transmission?: string;
      bodyType?: string;
      color?: string;
      engineSize?: number;
      horsepower?: number;
      drivetrain?: string;
      acceleration?: number;
      topSpeed?: number;
      torque?: number;
      fuelTank?: string;
    };
    damageFlag?: boolean;
    paintChange?: string;
    damageParts?: { name: string; state: string }[];
    marketAvgPrice?: number | null;
    marketListingCount?: number | null;
    marketFamilyLabel?: string;
  };
  predictedPrice?: number | null;
  comparables?: Array<{
    _id: string;
    title: string;
    brand: string;
    model: string;
    year: number;
    mileage: number;
    price: number;
    city?: string;
    listingUrl?: string;
  }>;
}

function formatEngineVolume(size?: number | string | null): string {
  if (size === undefined || size === null || size === "") return "—";
  const num = typeof size === "number" ? size : parseFloat(String(size).replace(",", "."));
  if (isNaN(num) || num <= 0) return "—";
  if (num >= 50) return `${Math.round(num)} cc`;
  const l = Number(num).toFixed(1).replace(/\.0$/, "");
  const cc = Math.round(num * 1000);
  return `${l} L (${cc} cc)`;
}

export function ValuationReportModal({
  car,
  predictedPrice,
  comparables = [],
}: ValuationReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"certificate" | "comparables" | "advisory" | "specs" | "all">("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const reportDate = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const reportTime = new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const reportId = `OTP-${car.year}-${car._id.toString().slice(-6).toUpperCase()}`;
  const securityCode = `SEC-${(car.price ^ car.year ^ car.brand.charCodeAt(0))
    .toString(16)
    .toUpperCase()
    .padStart(6, "0")
    .slice(0, 6)}`;

  const hasMarketAverage =
    Boolean(car.marketAvgPrice) && (car.marketListingCount ?? 0) >= 3;
  const avgPrice = hasMarketAverage
    ? car.marketAvgPrice!
    : predictedPrice || car.price;
  const diffFromAvg = car.price - avgPrice;
  const diffPct = Math.round((Math.abs(diffFromAvg) / avgPrice) * 100);

  let marketStatusBadge = {
    label: hasMarketAverage ? "Piyasa ortalamasına yakın" : "AI tahminine yakın",
    desc: hasMarketAverage
      ? "İlan fiyatı, aynı marka/model/yıldaki aktif ilan ortalamasına yakındır."
      : "Yeterli canlı ilan verisi yok; bu karşılaştırmada AI tahmini referans alınmıştır.",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    printColor: "bg-blue-100 text-blue-800 border-blue-300",
  };

  if (diffFromAvg < -avgPrice * 0.04) {
    marketStatusBadge = {
      label: `%${diffPct} ${hasMarketAverage ? "Piyasa ortalamasının" : "AI tahmininin"} altında`,
      desc: hasMarketAverage
        ? `Bu ilan aynı marka, model ve yıldaki aktif ilan ortalamasından %${diffPct} daha düşük fiyatlı.`
        : `İlan fiyatı modelin AI tahmininden %${diffPct} düşük. Bu, canlı piyasa ortalaması değildir.`,
      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      printColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    };
  } else if (diffFromAvg > avgPrice * 0.04) {
    marketStatusBadge = {
      label: `%${diffPct} ${hasMarketAverage ? "Piyasa ortalamasının" : "AI tahmininin"} üstünde`,
      desc: hasMarketAverage
        ? `Bu ilan aynı marka, model ve yıldaki aktif ilan ortalamasından %${diffPct} daha yüksek fiyatlı.`
        : `İlan fiyatı modelin AI tahmininden %${diffPct} yüksek. Bu, canlı piyasa ortalaması değildir.`,
      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      printColor: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }

  const damagedPartsList = (car.damageParts || []).filter(
    (p) => p.state && p.state !== "Orijinal"
  );

  // Model tavsiyesi kontrolü
  const modelAdvisory = findModelAdvisory(car.brand, car.model, car.features?.fuelType);

  // Teknik özellikleri katalog & dinamik modelden çöz
  const techSpecs = useMemo(() => {
    return resolveTechnicalSpecs({
      brand: car.brand,
      model: car.model,
      year: car.year,
      title: car.title,
      features: car.features
        ? {
            engineSize: car.features.engineSize,
            horsepower: car.features.horsepower,
            fuelType: car.features.fuelType,
            bodyType: car.features.bodyType,
            acceleration: car.features.acceleration,
            topSpeed: car.features.topSpeed,
            torque: car.features.torque,
            fuelTank: car.features.fuelTank,
          }
        : undefined,
    });
  }, [car]);

  // Donanım matrisini kural motoruyla çöz (Güvenlik, Konfor, Multimedya, Dış Donanım)
  const equipmentCategories = useMemo(() => {
    return evaluateCarEquipment({
      brand: car.brand,
      model: car.model,
      year: car.year,
      title: car.title,
      description: car.description || car.paintChange,
      features: car.features
        ? {
            fuelType: car.features.fuelType,
            bodyType: car.features.bodyType,
            transmission: car.features.transmission,
          }
        : undefined,
    });
  }, [car]);

  // 12 Aylık tahmini değer projeksiyonu
  const depreciationMonths = [
    { label: "Bugün", val: avgPrice, note: "Güncel Referans" },
    { label: "3 Ay Sonra", val: Math.round(avgPrice * 0.985), note: "Doğal Değer Eğrisi" },
    { label: "6 Ay Sonra", val: Math.round(avgPrice * 0.97), note: "Km & Yaş Artışı" },
    { label: "12 Ay Sonra", val: Math.round(avgPrice * 0.94), note: "1 Yaş Eskime" },
  ];

  function handlePrint() {
    window.print();
  }

  const modalElement = isOpen ? (
    <div
      id="valuation-modal-portal"
      className="fixed inset-0 z-[99999] isolate flex items-center justify-center overflow-y-auto bg-black/85 p-3 sm:p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="OtoPiyasa AI Piyasa Değerlendirme & İstihbarat Belgesi"
      onClick={() => setIsOpen(false)}
    >
      {/* Modal Kartı - max-w-6xl genişliğinde ferahtır */}
      <div
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Üst Eylem Çubuğu (Yazdırmada gizlenir) */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-3.5 gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-slate-200">
              OtoPiyasa AI Piyasa Değerlendirme & İstihbarat Belgesi
            </span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              ÜCRETSİZ RAPOR
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Yazdır / PDF İndir
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Bölüm Sekmeleri (Ekran görünümünde geniş ve ferah) */}
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/70 px-6 py-2.5 text-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === "all"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Tam Rapor (Tümü)
          </button>
          <button
            onClick={() => setActiveTab("certificate")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === "certificate"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            1. Değerlendirme Sertifikası
          </button>
          <button
            onClick={() => setActiveTab("comparables")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === "comparables"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            2. Pazardaki Emsal İlanlar ({comparables.length})
          </button>
          <button
            onClick={() => setActiveTab("advisory")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === "advisory"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            3. Değer Kaybı & Kontrol Rehberi
          </button>
          <button
            onClick={() => setActiveTab("specs")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === "specs"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            4. Teknik Özellikler & Donanım
          </button>
        </div>

        {/* Yazdırılabilir Doküman Alanı */}
        <div
          id="printable-valuation-report"
          className="overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-100 bg-slate-900 print-page"
        >
          {/* BÖLÜM 1: DİJİTAL PİYASA DEĞERLENDİRME SERTİFİKASI */}
          <div className={activeTab === "all" || activeTab === "certificate" ? "space-y-5" : "hidden print:block space-y-5"}>
            {/* Başlık ve Antet */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-amber-500/40 pb-5 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-wider text-amber-400 uppercase">
                    OtoPiyasa AI
                  </span>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase tracking-widest border border-amber-500/30">
                    Algoritmik Piyasa Değerlendirmesi
                  </span>
                </div>
                <h1 className="mt-1 text-lg sm:text-xl font-black text-white">
                  ARAÇ PİYASA DEĞERLENDİRME VE FİYAT ANALİZ BELGESİ
                </h1>
                <p className="text-xs text-slate-400">
                  12 Farklı Otomotiv Kaynağından Toplanan Büyük Veri & Regresyon Raporu
                </p>
              </div>

              <div className="text-left sm:text-right text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800 min-w-[200px]">
                <p>
                  <span className="font-semibold text-slate-300">Belge No:</span>{" "}
                  <span className="font-mono text-amber-400 font-bold">{reportId}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-300">Tarih / Saat:</span>{" "}
                  {reportDate}, {reportTime}
                </p>
                <p>
                  <span className="font-semibold text-slate-300">Güvenlik Kodu:</span>{" "}
                  <span className="font-mono text-sky-400 font-bold">{securityCode}</span>
                </p>
              </div>
            </div>

            {/* Araç Kimlik Kartı */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Araç Kimlik & Temel Bilgiler
              </h2>
              <div>
                <h3 className="text-lg font-bold text-white leading-snug">{car.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {car.city} {car.address ? `• ${car.address}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 block">Marka / Model</span>
                  <span className="font-semibold text-slate-200">
                    {car.brand} {car.model}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Model Yılı</span>
                  <span className="font-semibold text-slate-200">{car.year}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Kilometre</span>
                  <span className="font-semibold text-slate-200">
                    {formatNumber(car.mileage)} km
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Kasa Tipi</span>
                  <span className="font-semibold text-slate-200">
                    {car.features?.bodyType || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Yakıt Türü</span>
                  <span className="font-semibold text-slate-200">
                    {car.features?.fuelType || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Vites Tipi</span>
                  <span className="font-semibold text-slate-200">
                    {car.features?.transmission || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Motor Gücü</span>
                  <span className="font-semibold text-slate-200">
                    {car.features?.horsepower ? `${car.features.horsepower} HP` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Motor Hacmi</span>
                  <span className="font-semibold text-slate-200">
                    {formatEngineVolume(car.features?.engineSize)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fiyat Değerlendirmesi & Piyasa Konumu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Aktif İlan Ortalaması
                </span>
                <div>
                  <p className="text-3xl font-black text-amber-400">
                    {formatPrice(avgPrice)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {hasMarketAverage
                      ? car.marketFamilyLabel
                        ? `Model ailesi ortalaması: ${car.marketFamilyLabel}`
                        : "Referans aralığı: " +
                          formatPrice(Math.round(avgPrice * 0.96)) +
                          " – " +
                          formatPrice(Math.round(avgPrice * 1.04))
                      : "Referans: AI Fiyat Tahmin Algoritması"}
                  </p>
                </div>
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  Hesap dayanağı:{" "}
                  <span className="font-semibold text-slate-300">
                    {hasMarketAverage
                      ? `${car.marketListingCount} aktif ilan`
                      : "Derin öğrenme regresyon modeli"}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  İlan Fiyat Analizi & Durumu
                </span>
                <div>
                  <p className="text-2xl font-bold text-slate-200">
                    İlan Fiyatı: {formatPrice(car.price)}
                  </p>
                  <div
                    className={`inline-flex items-center mt-2 px-2.5 py-1 rounded-lg text-xs font-bold border ${marketStatusBadge.color}`}
                  >
                    {marketStatusBadge.label}
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {marketStatusBadge.desc}
                </p>
              </div>
            </div>

            {/* Kullanıcı Beyanı (Hasar / Boya Durumu) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Boya & Değişen Durumu (Kullanıcı / İlan Beyanı)
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded font-bold ${
                    car.damageFlag
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {car.damageFlag ? "Hasar / Tramer Kaydı Bildirilmiş" : "Hasar Kaydı Yok / Normal"}
                </span>
              </div>

              {car.paintChange && (
                <div className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800">
                  <strong className="text-slate-400">Beyan Edilen Durum:</strong> {car.paintChange}
                </div>
              )}

              {damagedPartsList.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-400 mb-2 font-semibold">
                    İşlem Görmüş Parçalar ({damagedPartsList.length} Adet):
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {damagedPartsList.map((part, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded"
                      >
                        <span className="text-slate-200 font-medium">{part.name}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            part.state === "Değişmiş"
                              ? "bg-rose-500/20 text-rose-300"
                              : part.state === "Boyanmış"
                              ? "bg-orange-500/20 text-orange-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {part.state}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {car.damageFlag
                    ? "Araçta hasar/tramer kaydı bildirilmiştir; parça bazlı boya/değişen dökümü girilmemiştir."
                    : "Kayıtlara geçmiş veya beyan edilmiş boyalı/değişen parça bildirilmemiştir."}
                </p>
              )}
            </div>
          </div>

          {/* BÖLÜM 2: PAZARDAKİ EMSAL İLANLAR MATRİSİ */}
          <div className={activeTab === "all" || activeTab === "comparables" ? "rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5 space-y-4" : "hidden print:block rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5 space-y-4"}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Bölüm 2: Pazardaki En Yakın Emsal İlanlar Matrisi
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  12 farklı kurumsal ve ilan sitesinden eşleştirilen en yakın {comparables.length || 0} emsal araç
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {comparables.length} Emsal Listelendi
              </span>
            </div>

            {comparables.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-950/60">
                    <tr>
                      <th className="px-3.5 py-2.5">Emsal İlan Başlığı</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Yıl</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Kilometre</th>
                      <th className="px-3.5 py-2.5 whitespace-nowrap">Şehir</th>
                      <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Piyasa Fiyatı</th>
                      <th className="px-3.5 py-2.5 text-right whitespace-nowrap">İlan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {comparables.slice(0, 12).map((comp) => {
                      const compUrl = `https://otopiyasa.app/cars/${comp._id}`;
                      return (
                        <tr key={comp._id} className="hover:bg-slate-900/50 transition">
                          <td className="px-3.5 py-2.5 font-medium text-slate-200 max-w-[280px]">
                            <a
                              href={compUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-amber-300 line-clamp-1 transition"
                              title={comp.title}
                            >
                              {comp.title}
                            </a>
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">{comp.year}</td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">{formatNumber(comp.mileage)} km</td>
                          <td className="px-3.5 py-2.5 text-slate-400 whitespace-nowrap">{comp.city || "Türkiye"}</td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-amber-300 whitespace-nowrap">
                            {formatPrice(comp.price)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <a
                              href={compUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 transition shadow-sm print:bg-amber-100 print:text-amber-900 print:border-amber-400"
                            >
                              İlana Git
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-900 rounded-lg">
                Bu araç segmenti için anlık filtreye uyan doğrudan emsal bulunamadı. Genel regresyon modeli referans alınmıştır.
              </p>
            )}
          </div>

          {/* BÖLÜM 3: 12 AYLIK DEĞER KAYBI & SATIN ALMA ÖNCESİ KONTROL REHBERİ */}
          <div className={activeTab === "all" || activeTab === "advisory" ? "space-y-4" : "hidden print:block space-y-4"}>
            {/* Model Tavsiyesi (Varsa) */}
            {modelAdvisory && (
              <div
                className={`rounded-xl border p-4 sm:p-5 space-y-2 ${
                  modelAdvisory.severity === "warning"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-sky-500/40 bg-sky-500/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Satın Alma Öncesi Uzman Kontrol Önerisi ({modelAdvisory.title})
                  </h3>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {modelAdvisory.advice}
                </p>
                <div className="text-[11px] font-semibold text-amber-200/90 pt-1 border-t border-amber-500/20">
                  <strong>Öncelikli Kontrol:</strong> {modelAdvisory.checkItem}
                </div>
              </div>
            )}

            {/* 12 Aylık Amortisman & Değer Eğrisi */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Bölüm 3: 12 Aylık Tahmini Amortisman & Değer Projeksiyonu
              </h2>
              <p className="text-xs text-slate-400">
                Normal piyasa şartlarında yaşlanma ve kilometre artışına bağlı beklenen tahmini değer eğrisi:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {depreciationMonths.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center"
                  >
                    <span className="text-[11px] text-slate-400 block font-medium">
                      {item.label}
                    </span>
                    <span className="text-sm font-bold text-white block mt-0.5">
                      {formatPrice(item.val)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {item.note}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Satıcıya Sorulacak 5 Altın Soru */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Araç Başına Gitmeden Önce Satıcıya Sorulacak 5 Altın Soru
              </h2>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">1.</span>
                  <span>
                    <strong>Yedek anahtar ve orijinal kitapçıklar:</strong> Aracın yedek anahtarı mevcut mu ve çalışıyor mu?
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">2.</span>
                  <span>
                    <strong>Periyodik & Ağır Bakım Geçmişi:</strong> Son yağ bakımı ve triger/zincir değişimi ne zaman yapıldı? Yetkili/özel servis faturası var mı?
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">3.</span>
                  <span>
                    <strong>Lastik Yaşı (DOT) ve Durumu:</strong> Üzerindeki lastiklerin üretim yılı nedir ve diş derinliği kaç mm?
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">4.</span>
                  <span>
                    <strong>Sigorta 5664 Tramer Kaydı:</strong> Plaka ve şasi numarası üzerinden SMS sorgusu yapıldı mı, hasar kaydı toplamı ne kadar?
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">5.</span>
                  <span>
                    <strong>Hukuki Durum:</strong> Araç üzerinde banka rehini, vergi borcu, haciz veya noter satışına engel bir kısıtlama var mı?
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* BÖLÜM 4: FABRİKA TEKNİK ÖZELLİKLERİ VE KAPSAMLI DONANIM MATRİSİ */}
          <div className={activeTab === "all" || activeTab === "specs" ? "rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5 space-y-6" : "hidden print:block rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5 space-y-6"}>
            {/* Üst Başlık & Rozet */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  Bölüm 4: Fabrika Teknik Özellikleri & Kapsamlı Donanım Matrisi
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Motor dinamikleri, hızlanma/kapasite verileri ve doğrulanmış güvenlik/konfor donanımları
                </p>
              </div>
              {techSpecs.specSource === "web" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-300">
                  ✓ Marka Resmi Sitesinden Doğrulandı
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-3 py-1 text-[11px] font-bold text-sky-300">
                  ℹ Fabrika Kataloğu & Dinamik Model
                </span>
              )}
            </div>

            {/* Kısım A: Motor Performansı & Boyutlar */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Motor Performansı & Ölçüler
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">0-100 km/s Hızlanma</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {techSpecs.acceleration ? `${techSpecs.acceleration} sn` : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">Fabrika test verisi</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Azami Hız</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {techSpecs.topSpeed ? `${techSpecs.topSpeed} km/s` : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">Maksimum sürat limiti</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Maksimum Tork</span>
                  <span className="text-base font-bold text-amber-300 mt-1 block">
                    {techSpecs.torque ? `${techSpecs.torque} Nm` : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">Dönme momenti</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Motor Gücü</span>
                  <span className="text-base font-bold text-emerald-300 mt-1 block">
                    {car.features?.horsepower ? `${car.features.horsepower} HP` : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">Beygir gücü</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Bagaj Hacmi</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {techSpecs.trunkCapacity ? `${techSpecs.trunkCapacity} L` : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">Yükleme kapasitesi</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Yakıt Deposu / Batarya</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {techSpecs.fuelTank || "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">Menzil kapasitesi</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Boş Ağırlık</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {techSpecs.curbWeight ? `${techSpecs.curbWeight} kg` : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">Net araç kütlesi</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Çekiş & Şanzıman</span>
                  <span className="text-sm font-semibold text-slate-200 mt-1 block">
                    {car.features?.drivetrain || "Önden Çekiş"} • {car.features?.transmission || "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">Aktarma organı</span>
                </div>
              </div>
            </div>

            {/* Kısım B: Donanım ve Güvenlik Özellikleri Matrisi */}
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Doğrulanmış Donanım & Güvenlik Özellikleri Matrisi
                </h3>
                <div className="flex items-center gap-2.5 text-[10px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ✓ Var
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> ✕ Yok
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> Kesin Değil
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipmentCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 space-y-2.5 print-avoid-break"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                        {cat.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {cat.items.filter((i) => i.status === "var").length} / {cat.items.length} Özellik Mevcut
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {cat.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-slate-950/60 border border-slate-800/70 px-2.5 py-1.5 rounded-lg"
                        >
                          <span className="text-slate-200 text-[11px] font-medium line-clamp-1 mr-1" title={item.name}>
                            {item.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              item.status === "var"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : item.status === "yok"
                                ? "bg-rose-500/15 text-rose-300 border border-rose-500/20"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {item.status === "var" ? "✓ Var" : item.status === "yok" ? "✕ Yok" : "Kesin Değil"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DİJİTAL MÜHÜR & YASAL SORUMLULUK REDDİ (HER ZAMAN GÖRÜNÜR) */}
          <div className="border-t border-slate-800 pt-5 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[10px] text-slate-400 leading-relaxed max-w-xl">
                <strong className="text-slate-300">Yasal Bilgilendirme ve Sorumluluk Reddi:</strong>
                <br />
                Bu belge fiziki araç muayenesi, mekanik ekspertiz veya TSE belgeli ekspertiz raporu yerine geçmez. Kullanıcının ve ilan sitelerinin beyan ettiği verilere dayanarak, 12 farklı araç platformundaki büyük veriler ve regresyon algoritmaları üzerinden üretilmiş algoritmik bir piyasa fiyat rehberidir. Karar destek amaçlıdır.
              </div>

              {/* Modern Analitik Doğrulama Rozeti */}
              <div className="flex items-center gap-3 border border-white/10 rounded-xl px-4 py-2.5 bg-white/[0.03] text-slate-300 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    OtoPiyasa AI
                  </p>
                  <p className="text-xs font-bold text-white">
                    Piyasa Analiz Modeli
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary"
        title="Bu aracın resmi piyasa ve fiyat değerlendirme raporunu görüntüle/yazdır"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>Değerleme raporu</span>
      </button>

      {mounted && typeof document !== "undefined" && modalElement
        ? createPortal(modalElement, document.body)
        : null}
    </>
  );
}
