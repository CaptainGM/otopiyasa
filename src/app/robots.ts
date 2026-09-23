import { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = appBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/favorites", "/my-listings", "/login"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
