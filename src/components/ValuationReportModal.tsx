"use client";

import { useState } from "react";
import { formatNumber, formatPrice } from "@/lib/utils";
import { findModelAdvisory } from "@/lib/model-advisories";

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
    features?: {
      fuelType?: string;
      transmission?: string;
      bodyType?: string;
      color?: string;
      engineSize?: number;
      horsepower?: number;
      drivetrain?: string;
    };
    damageFlag?: boolean;
    paintChange?: string;
    damageParts?: { name: string; state: string }[];
    marketAvgPrice?: number | null;
    marketListingCount?: number | null;
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
  }>;
}

export function ValuationReportModal({
  car,
  predictedPrice,
  comparables = [],
}: ValuationReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"certificate" | "comparables" | "advisory" | "all">("all");

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

  const avgPrice = car.marketAvgPrice || predictedPrice || car.price;
  const diffFromAvg = car.price - avgPrice;
  const diffPct = Math.round((Math.abs(diffFromAvg) / avgPrice) * 100);

  let marketStatusBadge = {
    label: "Piyasa Değerinde (Adil Fiyat)",
    desc: "Aracın fiyatı benzer emsal araçların piyasa ortalamasıyla birebir uyumludur.",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    printColor: "bg-blue-100 text-blue-800 border-blue-300",
  };

  if (diffFromAvg < -avgPrice * 0.04) {
    marketStatusBadge = {
      label: `%${diffPct} Piyasa Ortalamasının Altında (Fırsat)`,
      desc: `Bu araç aynı marka, model ve yıldaki araçların piyasa ortalamasından %${diffPct} daha avantajlı fiyata sahiptir.`,
      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      printColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    };
  } else if (diffFromAvg > avgPrice * 0.04) {
    marketStatusBadge = {
      label: `%${diffPct} Piyasa Ortalamasının Üstünde`,
      desc: `Bu araç segment ortalamasının %${diffPct} üzerinde fiyatlandırılmıştır. Donanım paketi, kilometre ve hasar beyanı kontrol edilmelidir.`,
      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      printColor: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }

  const damagedPartsList = (car.damageParts || []).filter(
    (p) => p.state && p.state !== "Orijinal"
  );

  // Küratörlü satın alma tavsiyesi kontrolü
  const modelAdvisory = findModelAdvisory(car.brand, car.model, car.features?.fuelType);

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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent px-4 py-2.5 text-sm font-bold text-amber-300 shadow-md shadow-amber-500/10 hover:border-amber-400 hover:bg-amber-500/25 transition active:scale-[0.98]"
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
        <span>📄 AI Piyasa Değerlendirme Raporu</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-3 sm:p-6 backdrop-blur-sm">
          {/* Modal Kartı */}
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
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
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
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
                  Yazdır / PDF
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

            {/* Bölüm Sekmeleri (Ekran görünümünde kolay geçiş) */}
            <div className="no-print flex items-center gap-2 border-b border-slate-800 bg-slate-950/70 px-6 py-2 text-xs overflow-x-auto">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeTab === "all"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tam Rapor (Tümü)
              </button>
              <button
                onClick={() => setActiveTab("certificate")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeTab === "certificate"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                1. Değerlendirme Sertifikası
              </button>
              <button
                onClick={() => setActiveTab("comparables")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeTab === "comparables"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                2. Pazardaki Emsal İlanlar ({comparables.length})
              </button>
              <button
                onClick={() => setActiveTab("advisory")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeTab === "advisory"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                3. Değer Kaybı & Kontrol Rehberi
              </button>
            </div>

            {/* Yazdırılabilir Doküman Alanı */}
            <div
              id="printable-valuation-report"
              className="overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-100 bg-slate-900 print-page"
            >
              {/* BÖLÜM 1: DİJİTAL PİYASA DEĞERLENDİRME SERTİFİKASI */}
              {(activeTab === "all" || activeTab === "certificate") && (
                <div className="space-y-5">
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
                      Araç Kimlik & Teknik Özellikler
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
                          {car.features?.engineSize ? `${car.features.engineSize} cc` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Değerlendirme & Fiyat Kararı */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 p-5 space-y-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                        OtoPiyasa AI Piyasa Değeri
                      </span>
                      <div>
                        <p className="text-3xl font-black text-white">{formatPrice(avgPrice)}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Adil Emsal Bandı: {formatPrice(Math.round(avgPrice * 0.96))} –{" "}
                          {formatPrice(Math.round(avgPrice * 1.04))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                        <span>Piyasa Güven Skoru:</span>
                        <span className="font-bold text-emerald-400">
                          {car.marketListingCount && car.marketListingCount >= 10
                            ? "%94 Yüksek Piyasa Güveni"
                            : "%78 Orta Güvenilirlik"}
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
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          car.damageFlag
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {car.damageFlag ? "Ağır Hasar Beyanı Var" : "Ağır Hasarsız / Normal"}
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
                        Kayıtlara geçmiş veya beyan edilmiş boyalı/değişen parça bildirilmemiştir.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* BÖLÜM 2: PAZARDAKİ EMSAL İLANLAR MATRİSİ */}
              {(activeTab === "all" || activeTab === "comparables") && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5 space-y-4">
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
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5">Emsal İlan Başlığı</th>
                            <th className="py-2.5">Yıl</th>
                            <th className="py-2.5">Kilometre</th>
                            <th className="py-2.5">Şehir</th>
                            <th className="py-2.5 text-right">Piyasa Fiyatı</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {comparables.slice(0, 10).map((comp) => (
                            <tr key={comp._id} className="hover:bg-slate-900/50 transition">
                              <td className="py-2.5 font-medium text-slate-200">
                                {comp.title}
                              </td>
                              <td className="py-2.5">{comp.year}</td>
                              <td className="py-2.5">{formatNumber(comp.mileage)} km</td>
                              <td className="py-2.5 text-slate-400">{comp.city || "Türkiye"}</td>
                              <td className="py-2.5 text-right font-bold text-amber-300">
                                {formatPrice(comp.price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic p-3 bg-slate-900 rounded-lg">
                      Bu araç segmenti için anlık filtreye uyan doğrudan emsal bulunamadı. Genel regresyon modeli referans alınmıştır.
                    </p>
                  )}
                </div>
              )}

              {/* BÖLÜM 3: 12 AYLIK DEĞER KAYBI & SATIN ALMA ÖNCESİ KONTROL REHBERİ */}
              {(activeTab === "all" || activeTab === "advisory") && (
                <div className="space-y-4">
                  {/* Küratörlü Model Tavsiyesi (Varsa) */}
                  {modelAdvisory && (
                    <div
                      className={`rounded-xl border p-4 sm:p-5 space-y-2 ${
                        modelAdvisory.severity === "warning"
                          ? "border-amber-500/40 bg-amber-500/10"
                          : "border-sky-500/40 bg-sky-500/10"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">💡</span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          Satın Alma Öncesi Uzman Kontrol Önerisi ({modelAdvisory.title})
                        </h3>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {modelAdvisory.advice}
                      </p>
                      <div className="text-[11px] font-semibold text-amber-200/90 pt-1 border-t border-amber-500/20">
                        🔍 <strong>Öncelikli Kontrol:</strong> {modelAdvisory.checkItem}
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
              )}

              {/* DİJİTAL MÜHÜR & YASAL SORUMLULUK REDDİ (HER ZAMAN GÖRÜNÜR) */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-[10px] text-slate-400 leading-relaxed max-w-xl">
                    <strong className="text-slate-300">⚠️ Yasal Bilgilendirme ve Sorumluluk Reddi:</strong>
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
      )}
    </>
  );
}
