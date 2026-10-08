import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["playwright", "playwright-core"],
  // Geliştirme sunucusu proje klasörünün tamamını izliyordu: tarama her ilanda logs/ içine ilerleme yazdığı için
  // sunucu saniyede bir yeniden derleniyordu ("Compiled in 1.5s" satırları, sürekli işlemci). Kaynak kodu dışındaki
  // klasörler izlenmez.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/logs/**", "**/scratch/**", "**/mobile/**", "**/*.apk"],
      };
    }
    return config;
  },
  eslint: {
    // Run ESLint through the package script; keep production builds independent of lint startup.
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
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
    // Kullanıcıdan bağımsız sayfalar (ana sayfa 670 KB'tı ve her ziyaret sunucuya gidiyordu): yalnızca Vercel CDN'i
    // saklar (tarayıcıya giden Cache-Control değişmez). Giriş yapmış kullanıcıya özel arayüz içeren sayfalar
    // (ilan ayrıntısı, profil, ilanlarım...) burada YOK.
    const cdnPage = (seconds: number, stale: number) => [
      {
        key: "Vercel-CDN-Cache-Control",
        value: `public, s-maxage=${seconds}, stale-while-revalidate=${stale}`,
      },
    ];
    return [
      { source: "/", headers: cdnPage(300, 1800) },
      { source: "/analytics", headers: cdnPage(600, 3600) },
      { source: "/map", headers: cdnPage(600, 3600) },
      { source: "/predict", headers: cdnPage(3600, 86400) },
      { source: "/compare", headers: cdnPage(3600, 86400) },
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
