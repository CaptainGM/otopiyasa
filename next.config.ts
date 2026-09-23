import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["playwright", "playwright-core"],
  eslint: {
    // Run ESLint through the package script; keep production builds independent of lint startup.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "www.sahibinden.com" },
      { protocol: "https", hostname: "*.sahibinden.com" },
      { protocol: "https", hostname: "www.arabam.com" },
      { protocol: "https", hostname: "*.mncdn.com" },
      { protocol: "https", hostname: "asset.otomerkezi.net" },
      { protocol: "https", hostname: "*.otokoc.com.tr" },
    ],
  },
  async headers() {
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allowedOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
