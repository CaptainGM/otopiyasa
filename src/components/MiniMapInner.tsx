"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  zoom: number;
  /** true: sürükle, yakınlaştır (büyük pencere). false: yalnızca önizleme. */
  interactive: boolean;
}

/** Kutu sonradan büyüyünce (sütun dengelenince, görseller yüklenince) Leaflet kendiliğinden yeniden ölçmez; boş bant kalmasın diye izlenir. */
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** İlan konumunu gösteren Leaflet haritası. Konum ilçe/il merkezi olabildiği için işaret yaklaşık bir daire. */
export default function MiniMapInner({ lat, lng, zoom, interactive }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      className="h-full w-full"
      zoomControl={interactive}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      attributionControl={interactive}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ResizeWatcher />
      <CircleMarker
        center={[lat, lng]}
        radius={interactive ? 14 : 10}
        pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#f59e0b", fillOpacity: 0.9 }}
      />
    </MapContainer>
  );
}
