import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OtoPiyasa — Araç Fiyat Takip Platformu",
    short_name: "OtoPiyasa",
    description:
      "Türkiye ikinci el araç ilanlarını takip et: piyasa ortalaması, fiyat geçmişi, karşılaştırma ve fiyat alarmları.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b12",
    theme_color: "#070b12",
    lang: "tr",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
