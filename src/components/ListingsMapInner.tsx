"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { divIcon } from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { TURKEY_CENTER } from "@/lib/city-coords";
import { formatPrice } from "@/lib/utils";
import { CAR_PLACEHOLDER_SRC } from "@/components/CarThumb";
import { FallbackImage } from "@/components/FallbackImage";
import { CARD_IMAGE_SIZE } from "@/lib/image-url";
import { prettyDistrict, type MapCluster } from "@/lib/map-clusters";

export interface MapCar {
  _id: string;
  title: string;
  brand: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  address?: string;
  imageUrl: string;
  fuelType: string;
}

function shortPrice(price: number) {
  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    return `${millions.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}M`;
  }
  if (price >= 1_000) return `${Math.round(price / 1_000)}B`;
  return `${price}`;
}

function clusterPin(cluster: MapCluster) {
  const label = cluster.district ? prettyDistrict(cluster.district) : cluster.city;
  const single = cluster.count === 1;
  return divIcon({
    className: "map-pin-wrapper",
    html: single
      ? `<div class="map-price-pin">${shortPrice(cluster.minPrice)} ₺</div>`
      : `<div class="map-city-pin"><span class="map-city-pin-count">${cluster.count}</span><span class="map-city-pin-body"><b>${label}</b><i>${shortPrice(cluster.minPrice)} ₺'den</i></span></div>`,
    iconSize: [0, 0],
    iconAnchor: single ? [30, 15] : [40, 20],
    popupAnchor: [0, single ? -14 : -18],
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

function CarPopupRow({ car }: { car: MapCar }) {
  return (
    <Link href={`/cars/${car._id}`} className="map-popup-row">
     
      <FallbackImage
        src={car.imageUrl}
        alt={car.title}
        preferSize={CARD_IMAGE_SIZE}
        fallback={<img src={CAR_PLACEHOLDER_SRC} alt="" />}
      />
      <span className="map-popup-row-info">
        <b>{car.title}</b>
        <i>
          {car.year} • {car.fuelType}
        </i>
        <em>{formatPrice(car.price)}</em>
      </span>
    </Link>
  );
}


function ClusterPopup({
  cluster,
  filterQuery,
  wholeCity,
  nearby,
}: {
  cluster: MapCluster;
  filterQuery: string;
  
  wholeCity: boolean;
  
  nearby: NearbyFilter | null;
}) {
  const [cars, setCars] = useState<MapCar[] | null>(null);
  const [error, setError] = useState(false);

  const nearKey = nearby ? `${nearby.lat},${nearby.lng},${nearby.radiusKm}` : "";
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(filterQuery);
    params.set("key", cluster.key);
    if (wholeCity) params.set("scope", "city");
    
    if (nearby) {
      params.set("near", `${nearby.lat},${nearby.lng}`);
      params.set("radiusKm", String(nearby.radiusKm));
    }
    fetch(`/api/map/cars?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => !cancelled && setCars(d.items || []))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [cluster.key, filterQuery, wholeCity, nearby, nearKey]);

  const title = cluster.district
    ? `${cluster.city} / ${prettyDistrict(cluster.district)}`
    : cluster.city;

  return (
    <div className="map-popup">
      <p className="map-popup-city">
        {title} — {cluster.count} ilan
        {!cluster.district && (wholeCity ? " (il geneli)" : " (ilçe bilgisi yok)")}
      </p>
      <div className="map-popup-list">
        {error ? (
          <p className="map-popup-empty">İlanlar yüklenemedi.</p>
        ) : cars === null ? (
          <p className="map-popup-empty">Yükleniyor…</p>
        ) : cars.length === 0 ? (
          <p className="map-popup-empty">İlan bulunamadı.</p>
        ) : (
          cars.map((car) => <CarPopupRow key={car._id} car={car} />)
        )}
      </div>
    </div>
  );
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
      byCity.set(cluster.city, { ...cluster });
    }
  }
  return [...byCity.values()].sort((a, b) => b.count - a.count);
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


function ClusterMarkers({
  clusters,
  filterQuery,
  nearby,
}: {
  clusters: MapCluster[];
  filterQuery: string;
  nearby: NearbyFilter | null;
}) {
  const zoom = useZoomLevel(6);
 
  const collapsed = !nearby && zoom < PROVINCE_ZOOM_LIMIT;
  const visible = collapsed ? collapseByProvince(clusters) : clusters;

  return (
    <>
      {visible.map((cluster) => (
        <Marker
          key={cluster.key}
          position={[cluster.lat, cluster.lng]}
          icon={clusterPin(cluster)}
        >
          <Popup maxWidth={300}>
            <ClusterPopup
              cluster={cluster}
              filterQuery={filterQuery}
              wholeCity={collapsed}
              nearby={nearby}
            />
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export interface NearbyFilter {
  lat: number;
  lng: number;
  radiusKm: number;
}

export default function ListingsMapInner({
  clusters,
  me,
  filterQuery,
  nearby,
}: {
  clusters: MapCluster[];
  me: { lat: number; lng: number } | null;
  filterQuery: string;
  nearby?: NearbyFilter | null;
}) {
  return (
    <MapContainer
      center={[TURKEY_CENTER.lat, TURKEY_CENTER.lng]}
      zoom={6}
      scrollWheelZoom
      className="h-[calc(100vh-320px)] min-h-[440px] w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      <FlyToMe me={me} />

      {me && (
        <>
          <Circle
            center={[me.lat, me.lng]}
            radius={(nearby?.radiusKm ?? 10) * 1000}
            pathOptions={{ color: "#f0b23c", weight: 1, fillOpacity: 0.05 }}
          />
          <Marker position={[me.lat, me.lng]} icon={mePin()} zIndexOffset={1000}>
            <Popup>Konumun</Popup>
          </Marker>
        </>
      )}

      <ClusterMarkers
        clusters={clusters}
        filterQuery={filterQuery}
        nearby={nearby ?? null}
      />
    </MapContainer>
  );
}
