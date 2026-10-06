"use client";

import { useState } from "react";
import { Lightbox } from "@/components/Lightbox";
import { Icon } from "@/components/Icon";

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
        title="Tam ekran aç"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIndex(0);
          setOpen(true);
        }}
        className="photo-btn"
      >
        <Icon name="expand" size={14} strokeWidth={1.9} />
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
