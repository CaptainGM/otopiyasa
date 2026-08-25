"use client";

import { useState } from "react";
import { Lightbox } from "@/components/Lightbox";


export function ImageLightboxButton({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const gallery = images.filter(Boolean);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (gallery.length === 0) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fotoğrafları tam ekran gör"
        title={
          gallery.length > 1
            ? `Tam ekran (${gallery.length} fotoğraf)`
            : "Tam ekran"
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIndex(0);
          setOpen(true);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <Lightbox
          images={gallery}
          title={title}
          index={index}
          onIndexChange={setIndex}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
