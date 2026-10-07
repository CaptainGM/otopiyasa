import Link from "next/link";
import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ChatWidget } from "@/components/ChatWidget";
import { CompareTray } from "@/components/CompareTray";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { appBaseUrl } from "@/lib/app-url";
import { Logo } from "@/components/Logo";

// Yazı ailesi (bkz. globals.css): gövde Inter, başlıklar geniş Archivo, rakamlar eş aralıklı IBM Plex Mono.
// latin-ext: ğ, ş, ı, İ gibi Türkçe harfler yedek yazı tipine düşmesin.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-archivo",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

/**
 * Arama sonuçlarında ve paylaşım önizlemelerinde görünen açıklama.
 * Projenin akademik olduğunu ve verinin kaynak sitelerden derlendiğini
 * açıkça belirtir — tek yerde tutulur ki metadata ile openGraph ayrışmasın.
 */
const SITE_DESCRIPTION =
  "Türkiye'deki ikinci el araç ilanlarını tek platformda takip edin. " +
  "OtoPiyasa, akademik amaçlı geliştirilmiş bir üniversite bitirme projesidir. " +
  "İlan verileri yalnızca karşılaştırma ve araştırma amacıyla kaynak sitelerden derlenmektedir.";

export const metadata: Metadata = {
  // Adres temizliği tek bir yerde: lib/app-url.ts (BOM/boşluk/sondaki "/").
  metadataBase: new URL(appBaseUrl()),
  title: "OtoPiyasa | İkinci El Araç Fiyat Takip & Değer Kaybı Analiz Platformu",
  description: SITE_DESCRIPTION,
  keywords: [
    "otopiyasa",
    "ikinci el araba",
    "araç fiyat takip",
    "piyasa analizi",
    "amortisman analizi",
    "değer kaybı",
    "hasar kaydı",
    "araba fiyatları",
    "ikinci el araç değer hesaplama",
  ],
  alternates: {
    canonical: "./",
  },
  openGraph: {
    title: "OtoPiyasa | İkinci El Araç Fiyat Takip & Piyasa Analizi",
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "tr_TR",
  },
  /**
   * Google'ın arama sonucunda boş dünya simgesi göstermesinin sebebi ikonun
   * hiç bildirilmemesiydi. Artık üç biçim de var:
   *  - icon.svg   : modern tarayıcılar (keskin, küçük dosya)
   *  - favicon.ico: tarayıcı ve tarayıcı botlarının KÖK DİZİNDE aradığı klasik
   *                 dosya — Google buna sıkça doğrudan istek atar
   *  - apple-icon.png: iOS ana ekran kısayolu (Apple SVG kabul etmiyor, bu
   *                 yüzden eski apple-icon.svg hiç sunulmuyordu → 404)
   */
  icons: {
    icon: [
      // Google favicon için 48 pikselin katı kare PNG/ICO ister (eski 64 px dosya bu yüzden kullanılmıyordu).
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = appBaseUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: baseUrl,
        name: "OtoPiyasa",
        description: SITE_DESCRIPTION,
        potentialAction: {
          "@type": "SearchAction",
          target: `${baseUrl}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
        inLanguage: "tr-TR",
      },
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: "OtoPiyasa",
        url: baseUrl,
        logo: `${baseUrl}/icon.svg`,
      },
    ],
  };

  // suppressHydrationWarning (html): aşağıdaki blocking script hydration'dan ÖNCE
  // data-theme'i DOM'a yazıyor (next-themes'in de kullandığı standart yöntem) —
  // React bu attribute'u hiç render etmiyor ama yine de sunucu/istemci farkı
  // olarak görüp gereksiz konsol uyarısı basıyordu.
  return (
    <html lang="tr" suppressHydrationWarning className={`${inter.variable} ${archivo.variable} ${plexMono.variable}`}>
      <head>
        {/* İlan fotoğrafları üçüncü taraf CDN'lerden geliyor: bağlantıyı önceden kur (ilk görsel gecikmesini azaltır). */}
        <link rel="preconnect" href="https://arbimg1.mncdn.com" crossOrigin="" />
        <link rel="preconnect" href="https://2el-cdn.otokoc.com.tr" crossOrigin="" />
        <link rel="dns-prefetch" href="https://cdn.otoplus.com" />
        <link rel="dns-prefetch" href="https://img.carvak.co" />
        <link rel="dns-prefetch" href="https://images.dod.com.tr" />
        <link rel="dns-prefetch" href="https://dat-tr-prda-ops-vava.azureedge.net" />
        <link rel="dns-prefetch" href="https://asset.otomerkezi.net" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {/* Tema tercihi paint'ten ÖNCE uygulanmalı, yoksa koyu→açık geçişi bir an
            için yanlış temada gösterip "flash" yapar (next/script bunun için
            yetersiz kalır çünkü hydration'ı bekler). */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('otopiyasa:theme')==='light'){document.documentElement.dataset.theme='light';}}catch(e){}",
          }}
        />
        <Navbar />
        <ErrorBoundary>
          <main className="container py-8">{children}</main>
        </ErrorBoundary>
        <footer className="mt-8 border-t border-[var(--border)] py-8">
          <div className="container flex flex-col items-center gap-3 text-center">
            <Logo />
            <p className="max-w-xl text-xs leading-relaxed text-[var(--faint)]">
              OtoPiyasa bir üniversite bitirme projesidir; ticari değildir. İlan verileri
              kaynak sitelerden yalnızca akademik amaçla derlenmiştir ve tüm hakları
              kaynaklarına aittir — her ilan orijinal kaynağına bağlantı verir.
            </p>
            <Link href="/gizlilik" className="text-xs text-[var(--muted)] hover:text-[var(--text)] hover:underline">
              Gizlilik politikası
            </Link>
          </div>
        </footer>
        <CompareTray />
        <ChatWidget />
      </body>
    </html>
  );
}
