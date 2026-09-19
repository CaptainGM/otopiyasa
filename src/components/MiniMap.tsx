"use client";

interface Props {
  lat: number;
  lng: number;
  zoom?: number;
}

export function MiniMap({ lat, lng, zoom = 13 }: Props) {
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <div className="h-48 rounded overflow-hidden">
      <iframe
        src={src}
        style={{ border: 0, width: '100%', height: '100%' }}
        loading="lazy"
        title="map"
      />
    </div>
  );
}
