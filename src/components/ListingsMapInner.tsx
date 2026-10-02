"use client";

import { useEffect, useRef, useState } from "react";
import { divIcon } from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { TURKEY_CENTER } from "@/lib/city-coords";
import { prettyDistrict, type MapCluster } from "@/lib/map-clusters";

export interface NearbyFilter {
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface ListingsMapInnerProps {
  clusters: MapCluster[];
  me: { lat: number; lng: number } | null;
  filterQuery: string;
  nearby?: NearbyFilter | null;
  selectedKey: string | null;
  onSelectCluster: (cluster: MapCluster, isWholeCity: boolean) => void;
}

function shortPrice(price: number) {
  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    return `${millions.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}M`;
  }
  if (price >= 1_000) return `${Math.round(price / 1_000)}B`;
  return `${price}`;
}

function clusterPin(cluster: MapCluster, isSelected: boolean) {
  const label = cluster.district
    ? prettyDistrict(cluster.district)
    : cluster.level === "province"
    ? `${cluster.city} (İl Geneli)`
    : cluster.city;

  const single = cluster.count === 1;
  const activeCls = isSelected ? " map-pin-selected" : "";

  let densityCls = "map-pin-density-low";
  if (cluster.count >= 500) densityCls = "map-pin-density-high";
  else if (cluster.count >= 50) densityCls = "map-pin-density-mid";

  const countStr =
    cluster.count >= 1000
      ? `${(cluster.count / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}B`
      : `${cluster.count}`;

  const html = single
    ? `<div class="map-price-pin${activeCls}">${shortPrice(cluster.minPrice)} ₺</div>`
    : `<div class="map-city-pin ${densityCls}${activeCls}">
        <span class="map-city-pin-count">${countStr}</span>
        <span class="map-city-pin-body">
          <b>${label}</b>
          <i>${shortPrice(cluster.minPrice)} ₺'den</i>
        </span>
      </div>`;

  return divIcon({
    className: "map-pin-wrapper",
    html,
    iconSize: [0, 0],
    iconAnchor: single ? [30, 15] : [40, 20],
  });
}

function mePin() {
  return divIcon({
    className: "map-pin-wrapper",
    html: `<div class="map-me-pin" title="Konumun"></div>`,
    iconSize: [0, 0],
    iconAnchor: [9, 9],
  });
}

const PROVINCE_ZOOM_LIMIT = 8;

function useZoomLevel(initial: number) {
  const [zoom, setZoom] = useState(initial);
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });
  return zoom;
}

function collapseByProvince(clusters: MapCluster[]): MapCluster[] {
  const byCity = new Map<string, MapCluster>();
  for (const cluster of clusters) {
    const existing = byCity.get(cluster.city);
    if (existing) {
      existing.count += cluster.count;
      if (cluster.minPrice > 0 && cluster.minPrice < existing.minPrice) {
        existing.minPrice = cluster.minPrice;
      }
      existing.key = `${cluster.city}|`;
      existing.district = "";
    } else {
      byCity.set(cluster.city, { ...cluster, key: `${cluster.city}|`, district: "" });
    }
  }
  return [...byCity.values()].sort((a, b) => b.count - a.count);
}

function disperseClusters(
  clusters: MapCluster[]
): (MapCluster & { displayLat: number; displayLng: number })[] {
  const coordMap = new Map<string, number>();
  return clusters.map((c) => {
    const key = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
    const index = coordMap.get(key) || 0;
    coordMap.set(key, index + 1);
    if (index === 0) {
      return { ...c, displayLat: c.lat, displayLng: c.lng };
    }
    const angle = (index * 2.39996) % (2 * Math.PI);
    const radius = 0.006 + 0.004 * (index % 6);
    return {
      ...c,
      displayLat: c.lat + radius * Math.sin(angle),
      displayLng: c.lng + radius * Math.cos(angle),
    };
  });
}

function FlyToMe({ me }: { me: { lat: number; lng: number } | null }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    if (!me) return;
    const key = `${me.lat},${me.lng}`;
    if (last.current === key) return;
    last.current = key;
    map.flyTo([me.lat, me.lng], 9, { duration: 1.2 });
  }, [me, map]);
  return null;
}

function FloatingControls() {
  const map = useMap();
  return (
    <div className="absolute top-4 left-4 z-[900] flex flex-col gap-2 pointer-events-auto">
      <button
        type="button"
        onClick={() => map.flyTo([TURKEY_CENTER.lat, TURKEY_CENTER.lng], 6, { duration: 0.8 })}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c121d]/90 px-3.5 py-2 text-xs font-bold text-slate-200 shadow-xl backdrop-blur-md transition hover:border-amber-400/50 hover:bg-[#131d2e] hover:text-amber-300"
        title="Haritayı sıfırla"
      >
        <span>🇹🇷</span>
        <span>Tüm Türkiye</span>
      </button>
    </div>
  );
}

function ClusterMarkerItem({
  cluster,
  collapsed,
  isSelected,
  onSelect,
}: {
  cluster: MapCluster & { displayLat: number; displayLng: number };
  collapsed: boolean;
  isSelected: boolean;
  onSelect: (cluster: MapCluster, isWholeCity: boolean) => void;
}) {
  const map = useMap();

  return (
    <Marker
      position={[cluster.displayLat, cluster.displayLng]}
      icon={clusterPin(cluster, isSelected)}
      eventHandlers={{
        click: () => {
          if (collapsed) {
            // Şehir geneli kümesine tıklandığında popup açmak yerine şehre odaklan
            map.flyTo([cluster.lat, cluster.lng], 10, { duration: 0.8 });
          } else {
            map.panTo([cluster.lat, cluster.lng]);
            onSelect(cluster, false);
          }
        },
      }}
    />
  );
}

function ClusterMarkers({
  clusters,
  nearby,
  selectedKey,
  onSelect,
}: {
  clusters: MapCluster[];
  nearby: NearbyFilter | null;
  selectedKey: string | null;
  onSelect: (cluster: MapCluster, isWholeCity: boolean) => void;
}) {
  const zoom = useZoomLevel(6);
  const collapsed = !nearby && zoom < PROVINCE_ZOOM_LIMIT;
  const baseClusters = collapsed ? collapseByProvince(clusters) : clusters;
  const visible = disperseClusters(baseClusters);

  return (
    <>
      {visible.map((cluster) => {
        const isSelected = selectedKey === cluster.key;
        return (
          <ClusterMarkerItem
            key={`${cluster.key}-${collapsed}`}
            cluster={cluster}
            collapsed={collapsed}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

export default function ListingsMapInner({
  clusters,
  me,
  nearby,
  selectedKey,
  onSelectCluster,
}: ListingsMapInnerProps) {
  return (
    <div className="relative h-[calc(100vh-280px)] min-h-[520px] w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <MapContainer
        center={[TURKEY_CENTER.lat, TURKEY_CENTER.lng]}
        zoom={6}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FlyToMe me={me} />
        <FloatingControls />

        {me && (
          <>
            <Circle
              center={[me.lat, me.lng]}
              radius={(nearby?.radiusKm ?? 10) * 1000}
              pathOptions={{ color: "#f59e0b", weight: 1.5, fillOpacity: 0.08, fillColor: "#f59e0b" }}
            />
            <Marker position={[me.lat, me.lng]} icon={mePin()} zIndexOffset={1000} />
          </>
        )}

        <ClusterMarkers
          clusters={clusters}
          nearby={nearby ?? null}
          selectedKey={selectedKey}
          onSelect={onSelectCluster}
        />
      </MapContainer>
    </div>
  );
}
