import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OtoPiyasa — Araç Fiyat Takip Platformu",
    short_name: "OtoPiyasa",
    description:
      "Türkiye ikinci el araç ilanlarını takip et: piyasa ortalaması, fiyat geçmişi, karşılaştırma ve fiyat alarmları.",
    start_url: "/",
    // "browser": tarayıcının "uygulamayı yükle" istemi çıkmaz (eskiden web'in kendi kurulumu, APK'dan farklı bir sürümü kuruyordu).
    // Uygulamanın tek kurulum yolu üstteki şeritteki en yeni APK'dır.
    display: "browser",
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
