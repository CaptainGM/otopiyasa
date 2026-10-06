import { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/app-url";

/**
 * Site haritası yalnızca kalıcı sayfaları içerir. İlan sayfaları (/cars/...) arama motorlarına kapalıdır (bkz.
 * robots.ts): kaynak sitelerdeki ilanların kopyası oldukları için arama sonucunda değer taşımıyorlar, ama her bot
 * ziyareti Vercel'de sayfa çizimi demekti (ücretsiz plan ISR yazma ve işlemci limiti bundan tükeniyordu).
 * Günde bir yenilenir.
 */
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = appBaseUrl();
  const now = new Date();
  return [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/analytics`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/predict`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/map`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/gizlilik`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
