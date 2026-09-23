import { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/app-url";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = appBaseUrl();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/analytics`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/predict`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/gizlilik`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  try {
    await connectDB();
    const recentCars = await Car.find(PUBLIC_LISTING_FILTER, { _id: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    const carPages: MetadataRoute.Sitemap = (recentCars as unknown as Array<{ _id: { toString(): string }; updatedAt?: Date }>).map((c) => ({
      url: `${baseUrl}/cars/${c._id.toString()}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    }));

    return [...staticPages, ...carPages];
  } catch {
    return staticPages;
  }
}
