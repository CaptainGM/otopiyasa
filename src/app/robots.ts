import { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/app-url";

/**
 * Her sayfa isteği sunucudan veri çeker (Vercel ücretsiz planda aylık 10 GB sınırı var), bu yüzden:
 *  - filtre/arama adresleri (`/?marka=...`) taranmaz: sonsuz sayıda kombinasyon, hepsi 200+ KB;
 *  - yalnızca SEO/veri toplayan ve yapay zekâ eğitimi için tarayan botlar tamamen kapalı.
 * Google ve Bing normal tarar.
 */
const NOISY_BOTS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "Bytespider",
  "DataForSeoBot",
  "BLEXBot",
  "Amazonbot",
  "CCBot",
  "GPTBot",
  "ClaudeBot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = appBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // İlan sayfaları kapalı: kaynak sitelerdeki ilanların kopyası (arama sonucunda değer taşımaz) ve her bot
        // ziyareti Vercel'de sayfa çizimi demek. Kalıcı sayfalar (ana sayfa, analiz, fiyat tahmini, harita) taranır.
        disallow: ["/admin/", "/api/", "/cars/", "/favorites", "/my-listings", "/login", "/*?"],
      },
      { userAgent: NOISY_BOTS, disallow: "/" },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
