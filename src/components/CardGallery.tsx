"use client";

import { useState } from "react";
import { CarThumb } from "@/components/CarThumb";


export function CardGallery({
  images,
  alt,
  maxPhotos = 8,
}: {
  images: string[];
  alt: string;
  maxPhotos?: number;
}) {
  // Kartta tüm galeriyi gezdirmek gereksiz; ilk birkaç fotoğraf yeterli.
  const gallery = images.filter(Boolean).slice(0, maxPhotos);
  const [index, setIndex] = useState(0);

  const go = (e: React.MouseEvent, step: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + step + gallery.length) % gallery.length);
  };

  if (gallery.length === 0) {
    return <CarThumb alt={alt} className="object-cover" />;
  }

  return (
    <>
      <CarThumb
        key={gallery[index]}
        src={gallery[index]}
        alt={alt}
        className="object-cover transition duration-500 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 33vw"
      />

      {gallery.length > 1 && (
        <>
          <CardArrow side="left" onClick={(e) => go(e, -1)} />
          <CardArrow side="right" onClick={(e) => go(e, 1)} />
          {/* Konum göstergesi — kaçıncı fotoğrafta olduğun belli olsun */}
          <div className="pointer-events-none absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1 opacity-0 transition group-hover:opacity-100">
            {gallery.map((img, i) => (
              <span
                key={img + i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/45"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function CardArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: (e: React.MouseEvent) => void;
}) {
  
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki fotoğraf" : "Sonraki fotoğraf"}
      className={`absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/85 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
