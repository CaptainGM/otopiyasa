"use client";

import { useEffect, useState, useMemo } from "react";
import { formatRelativeTr } from "@/lib/utils";
import { useVisibleInterval } from "@/components/useVisibleInterval";

interface CountryStat {
  country: string;
  countryName: string;
  flag: string;
  flagUrl: string;
  count: number;
  uniqueIps: number;
  percentage: number;
}

interface VisitorRow {
  _id: string;
  ip: string;
  country: string;
  countryName: string;
  flag: string;
  flagUrl?: string;
  city: string;
  path: string;
  device: "desktop" | "mobile" | "tablet" | "bot" | "other";
  browser: string;
  os: string;
  referrer?: string;
  isRegistered?: boolean;
  userEmail?: string;
  userName?: string;
  isBot?: boolean;
  botName?: string;
  createdAt: string;
}

interface TrafficData {
  totalVisits: number;
  uniqueIps: number;
  onlineCount: number;
  countryCount: number;
  userBreakdown?: {
    registered: number;
    guest: number;
    bot: number;
  };
  countries: CountryStat[];
  deviceMap: Record<string, number>;
  topPages: Array<{ path: string; count: number }>;
  recentVisitors: VisitorRow[];
  updatedAt: string;
}

interface IpDetailModal {
  ip: string;
  loading: boolean;
  visits: VisitorRow[];
  firstSeen?: string;
  lastSeen?: string;
  totalActions?: number;
}

export function VisitorTrafficPanel() {
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState<"all" | "users" | "guests" | "bots" | "foreign">("all");
  const [selectedIpDetail, setSelectedIpDetail] = useState<IpDetailModal | null>(null);

  async function loadTraffic(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`/api/admin/traffic?range=${range}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // sessizce geç
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTraffic(true);
  }, [range]);

  useVisibleInterval(() => {
    loadTraffic(false);
  }, 15_000);

  async function inspectIp(ip: string) {
    setSelectedIpDetail({ ip, loading: true, visits: [] });
    try {
      const res = await fetch(`/api/admin/traffic?ip=${encodeURIComponent(ip)}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setSelectedIpDetail({
          ip,
          loading: false,
          visits: json.visits || [],
          firstSeen: json.firstSeen,
          lastSeen: json.lastSeen,
          totalActions: json.totalActions || 0,
        });
      } else {
        setSelectedIpDetail(null);
      }
    } catch {
      setSelectedIpDetail(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2000);
  }

  const filteredVisitors = useMemo(() => {
    if (!data?.recentVisitors) return [];
    let list = data.recentVisitors;

    if (activeFilterTab === "users") {
      list = list.filter((v) => v.isRegistered);
    } else if (activeFilterTab === "guests") {
      list = list.filter((v) => !v.isRegistered && !v.isBot);
    } else if (activeFilterTab === "bots") {
      list = list.filter((v) => v.isBot || v.device === "bot");
    } else if (activeFilterTab === "foreign") {
      list = list.filter((v) => v.country !== "TR");
    }

    const q = filterQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.ip.toLowerCase().includes(q) ||
        v.countryName.toLowerCase().includes(q) ||
        v.country.toLowerCase().includes(q) ||
        (v.city && v.city.toLowerCase().includes(q)) ||
        v.path.toLowerCase().includes(q) ||
        v.browser.toLowerCase().includes(q) ||
        v.os.toLowerCase().includes(q) ||
        (v.userEmail && v.userEmail.toLowerCase().includes(q)) ||
        (v.userName && v.userName.toLowerCase().includes(q)) ||
        (v.botName && v.botName.toLowerCase().includes(q))
    );
  }, [data?.recentVisitors, filterQuery, activeFilterTab]);

  const totalDevices =
    (data?.deviceMap?.desktop || 0) +
    (data?.deviceMap?.mobile || 0) +
    (data?.deviceMap?.tablet || 0) +
    (data?.deviceMap?.bot || 0);

  const mobilePercent = totalDevices > 0 ? Math.round(((data?.deviceMap?.mobile || 0) / totalDevices) * 100) : 0;
  const desktopPercent = totalDevices > 0 ? Math.round(((data?.deviceMap?.desktop || 0) / totalDevices) * 100) : 0;

  const totalUserActions = (data?.userBreakdown?.registered || 0) + (data?.userBreakdown?.guest || 0);
  const registeredPercent =
    totalUserActions > 0 ? Math.round(((data?.userBreakdown?.registered || 0) / totalUserActions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Üst Bar: Başlık, Canlı Durum ve Tarih Seçici */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 p-4 rounded-xl backdrop-blur-md shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>🌐</span> Canlı Trafik & Ziyaretçi Denetimi
            </h2>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Canlı Takip
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Sitede gezinen gerçek kullanıcılar, IP adresleri, oturum durumları ve sayfalar</span>
            <span className="hidden md:inline-block text-slate-600">·</span>
            <span className="hidden md:inline-block text-slate-500 text-[11px]">Otomatik yenileme: 15s</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  range === r
                    ? "bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {r === "24h" ? "Son 24 Saat" : r === "7d" ? "Son 7 Gün" : "Son 30 Gün"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadTraffic(true)}
            disabled={loading}
            className="btn btn-ghost text-xs px-3 py-1.5 border border-slate-700/60 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 rounded-lg"
            title="Şimdi Yenile"
          >
            <span className={loading ? "animate-spin" : ""}>🔄</span>
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* 4 Ana Metrik Kartı */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Toplam İstek */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Toplam Sayfa İsteği</span>
            <span className="text-base">📈</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {loading && !data ? "..." : (data?.totalVisits || 0).toLocaleString("tr-TR")}
            </span>
            <span className="text-xs text-slate-400">gösterim</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {range === "24h" ? "Son 24 saatte" : range === "7d" ? "Son 7 günde" : "Son 30 günde"} kaydedilen
          </div>
        </div>

        {/* 2. Tekil Ziyaretçi & Canlı Online */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tekil Ziyaretçi (IP)</span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              {data?.onlineCount || 0} aktif
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {loading && !data ? "..." : (data?.uniqueIps || 0).toLocaleString("tr-TR")}
            </span>
            <span className="text-xs text-emerald-500/80">farklı IP</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Son 5 dk: {data?.onlineCount || 0} kişi geziniyor</div>
        </div>

        {/* 3. Kullanıcı Tipi (Üye vs Misafir) */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Oturum & Hesap Durumu</span>
            <span className="text-base">👤</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between font-mono">
            <span className="text-lg font-bold text-emerald-400">
              {data?.userBreakdown?.registered || 0} <span className="text-xs text-slate-400 font-normal">Üye</span>
            </span>
            <span className="text-sm font-semibold text-slate-300">
              {data?.userBreakdown?.guest || 0} <span className="text-xs text-slate-500 font-normal">Misafir</span>
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            %{registeredPercent} kayıtlı üye etkileşimi
          </div>
        </div>

        {/* 4. Cihaz Dağılımı */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cihaz Dağılımı</span>
            <span className="text-base">📱</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between font-mono">
            <span className="text-lg font-bold text-sky-400">%{mobilePercent} Mobil</span>
            <span className="text-sm font-semibold text-slate-400">%{desktopPercent} PC</span>
          </div>
          <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
            <div style={{ width: `${mobilePercent}%` }} className="bg-sky-400 h-full" />
            <div style={{ width: `${desktopPercent}%` }} className="bg-slate-500 h-full" />
          </div>
        </div>
      </div>

      {/* 2 Sütun: Gerçek Bayraklı Ülke Dağılımı & En Çok Ziyaret Edilen Sayfalar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ülke Dağılımı */}
        <div className="lg:col-span-7 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>🌍</span> Ülkelere Göre Ziyaret Dağılımı
            </h3>
            <span className="text-xs text-slate-500">Ziyaret & Oran</span>
          </div>

          {loading && !data ? (
            <div className="py-8 text-center text-slate-500 text-xs">Yükleniyor...</div>
          ) : !data?.countries || data.countries.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Henüz bu zaman aralığında kaydedilmiş ziyaret yok.
            </div>
          ) : (
            <div className="space-y-3">
              {data.countries.map((c) => (
                <div key={c.country} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      {c.flagUrl ? (
                        <img
                          src={c.flagUrl}
                          alt={c.countryName}
                          className="w-5 h-3.5 object-cover rounded shadow-sm border border-slate-700/60 inline-block"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-base">{c.flag || "🌐"}</span>
                      )}
                      <span className="font-semibold text-slate-200">{c.countryName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                        {c.country}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-400 text-[11px]">{c.uniqueIps} tekil IP</span>
                      <span className="font-bold text-slate-100">{c.count} istek</span>
                      <span className="text-amber-400 text-xs font-bold w-9 text-right">%{c.percentage}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(c.percentage, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* En Çok Ziyaret Edilen Sayfalar */}
        <div className="lg:col-span-5 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>🔥</span> En Çok Ziyaret Edilen Sayfalar
            </h3>
            <span className="text-xs text-slate-500">İstek</span>
          </div>

          {loading && !data ? (
            <div className="py-8 text-center text-slate-500 text-xs">Yükleniyor...</div>
          ) : !data?.topPages || data.topPages.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">Henüz sayfa ziyareti kaydedilmedi.</div>
          ) : (
            <div className="space-y-2">
              {data.topPages.map((p, idx) => (
                <div
                  key={p.path}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden truncate max-w-[80%]">
                    <span className="font-mono text-slate-500 text-[11px] w-4">{idx + 1}.</span>
                    <span className="font-mono text-amber-300 truncate" title={p.path}>
                      {p.path === "/" ? "/ (Ana Sayfa)" : p.path}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-700/80 text-slate-200">
                    {p.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Canlı Son Ziyaretçiler Listesi & Arama & IP Gezinti Geçmişi */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>🕵️</span> Canlı Ziyaretçi & IP Akışı
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Siteye gelen son ziyaretçiler. Sayfa gezinti geçmişini görmek için satıra veya &quot;Geçmiş&quot; butonuna tıkla.
            </p>
          </div>

          {/* Filtre Butonları & Arama Kutusu */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setActiveFilterTab("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeFilterTab === "all" ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tümü ({data?.recentVisitors?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterTab("users")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeFilterTab === "users" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Üyeler
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterTab("guests")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeFilterTab === "guests" ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Misafirler
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterTab("foreign")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeFilterTab === "foreign" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Yurt Dışı
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterTab("bots")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeFilterTab === "bots" ? "bg-rose-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Botlar
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="IP, ülke, sayfa veya e-posta ara..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="text-xs bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 w-56 sm:w-64"
              />
              <span className="absolute left-2.5 top-1.5 text-slate-500 text-xs">🔍</span>
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tablo */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-700/60">
              <tr>
                <th className="py-2.5 px-3">IP Adresi</th>
                <th className="py-2.5 px-3">Ülke / Şehir</th>
                <th className="py-2.5 px-3">Kullanıcı Durumu</th>
                <th className="py-2.5 px-3">Görüntülenen Sayfa</th>
                <th className="py-2.5 px-3">Cihaz / Tarayıcı</th>
                <th className="py-2.5 px-3">Zaman</th>
                <th className="py-2.5 px-3 text-right">Eylem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Ziyaretçi kayıtları yükleniyor...
                  </td>
                </tr>
              ) : filteredVisitors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans text-xs">
                    {filterQuery || activeFilterTab !== "all"
                      ? "Filtre kriterlerine uygun ziyaretçi kaydı bulunamadı."
                      : "Henüz kaydedilmiş gerçek ziyaretçi bulunmuyor. Yeni bir sekmede siteyi açtığında burada anlık belirecektir."}
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((row) => {
                  const flagImg = row.flagUrl || (row.country ? `https://flagcdn.com/w40/${row.country.toLowerCase()}.png` : "");
                  return (
                    <tr
                      key={row._id}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => inspectIp(row.ip)}
                    >
                      {/* IP Adresi & Kopyalama */}
                      <td className="py-2.5 px-3 font-semibold text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span>{row.ip}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(row.ip);
                            }}
                            className="text-slate-500 hover:text-amber-400 transition-colors text-[11px]"
                            title="IP'yi kopyala"
                          >
                            {copiedIp === row.ip ? "✓" : "📋"}
                          </button>
                        </div>
                      </td>

                      {/* Gerçek Bayraklı Ülke & Şehir */}
                      <td className="py-2.5 px-3 text-slate-300 font-sans">
                        <div className="flex items-center gap-2">
                          {flagImg ? (
                            <img
                              src={flagImg}
                              alt={row.countryName}
                              className="w-4 h-3 object-cover rounded shadow-sm border border-slate-700/60 inline-block"
                              loading="lazy"
                            />
                          ) : (
                            <span>{row.flag || "🌐"}</span>
                          )}
                          <span className="font-medium text-slate-200">{row.countryName}</span>
                          {row.city && <span className="text-slate-500 text-[11px]">· {row.city}</span>}
                        </div>
                      </td>

                      {/* Kullanıcı / Oturum Durumu */}
                      <td className="py-2.5 px-3 font-sans">
                        {row.isBot ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-semibold">
                            🤖 {row.botName || "Tarayıcı Botu"}
                          </span>
                        ) : row.isRegistered ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold w-fit">
                              🟢 Kayıtlı Üye
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]" title={row.userEmail}>
                              {row.userEmail || row.userName}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 text-[11px]">
                            ⚪ Misafir
                          </span>
                        )}
                      </td>

                      {/* Gezilen Sayfa */}
                      <td className="py-2.5 px-3 font-mono">
                        <span className="text-amber-300 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 truncate max-w-[180px] inline-block" title={row.path}>
                          {row.path === "/" ? "/ (Ana Sayfa)" : row.path}
                        </span>
                      </td>

                      {/* Cihaz / Tarayıcı */}
                      <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span>{row.device === "mobile" ? "📱" : row.device === "tablet" ? "📟" : row.device === "bot" ? "🤖" : "💻"}</span>
                          <span>{row.browser}</span>
                          {row.os && <span className="text-slate-500">/ {row.os}</span>}
                        </div>
                      </td>

                      {/* Zaman */}
                      <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px] whitespace-nowrap">
                        {formatRelativeTr(new Date(row.createdAt))}
                      </td>

                      {/* Eylem */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            inspectIp(row.ip);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-sans font-medium transition"
                        >
                          Geçmiş ➔
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IP Gezinti Geçmişi & "Napıyor Sitemizde?" Detay Modalı */}
      {selectedIpDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔍</span>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                    {selectedIpDetail.ip}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedIpDetail.ip)}
                      className="text-xs text-slate-400 hover:text-amber-400"
                    >
                      {copiedIp === selectedIpDetail.ip ? "✓ Kopyalandı" : "📋 Kopyala"}
                    </button>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Bu IP adresinin sitemizdeki tüm gezinti adımları ve hareketleri
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIpDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {selectedIpDetail.loading ? (
              <div className="py-12 text-center text-slate-500 font-sans text-xs">
                Gezinti geçmişi yükleniyor...
              </div>
            ) : selectedIpDetail.visits.length === 0 ? (
              <div className="py-8 text-center text-slate-500 font-sans text-xs">
                Bu IP adresine ait geçmiş gezinti kaydı bulunamadı.
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto pr-1">
                {/* Ziyaretçi Özeti */}
                {selectedIpDetail.visits[0] && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Ülke / Şehir</span>
                      <span className="font-semibold text-slate-200">
                        {selectedIpDetail.visits[0].countryName} {selectedIpDetail.visits[0].city ? `(${selectedIpDetail.visits[0].city})` : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Hesap / Üye</span>
                      <span className="font-semibold text-slate-200">
                        {selectedIpDetail.visits[0].isRegistered
                          ? selectedIpDetail.visits[0].userEmail || "Kayıtlı Üye"
                          : selectedIpDetail.visits[0].isBot
                          ? "🤖 Bot"
                          : "Misafir"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Cihaz / Sistem</span>
                      <span className="font-semibold text-slate-200">
                        {selectedIpDetail.visits[0].browser} / {selectedIpDetail.visits[0].os}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Toplam Eylem</span>
                      <span className="font-semibold text-amber-300 font-mono">
                        {selectedIpDetail.totalActions || selectedIpDetail.visits.length} sayfa ziyareti
                      </span>
                    </div>
                  </div>
                )}

                {/* Gezinti Zaman Çizelgesi */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Gezinti Zaman Çizelgesi (Kronolojik Adımlar)
                  </h4>
                  <div className="space-y-2">
                    {selectedIpDetail.visits.map((step, idx) => (
                      <div
                        key={step._id || idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-xs font-mono"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-[10px] font-bold">
                            {selectedIpDetail.visits.length - idx}
                          </span>
                          <div>
                            <span className="text-slate-200 font-semibold">{step.path}</span>
                            {step.referrer && (
                              <span className="block text-[10px] text-slate-500 font-sans truncate max-w-sm">
                                Nereden geldi: {step.referrer}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-slate-400 text-[11px] font-sans">
                          {formatRelativeTr(new Date(step.createdAt))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedIpDetail(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
