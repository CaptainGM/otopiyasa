import Link from "next/link";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ChatWidget } from "@/components/ChatWidget";
import { CompareTray } from "@/components/CompareTray";
import { appBaseUrl } from "@/lib/app-url";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
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
  title: "OtoPiyasa | İkinci El Araç Fiyat Takip Platformu",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "OtoPiyasa | İkinci El Araç Fiyat Takip",
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
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
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
  // suppressHydrationWarning (html): aşağıdaki blocking script hydration'dan ÖNCE
  // data-theme'i DOM'a yazıyor (next-themes'in de kullandığı standart yöntem) —
  // React bu attribute'u hiç render etmiyor ama yine de sunucu/istemci farkı
  // olarak görüp gereksiz konsol uyarısı basıyordu.
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={inter.className}>
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
        <main className="container py-8">{children}</main>
        <footer className="border-t border-white/5 py-6">
          <p className="container text-center text-xs leading-relaxed text-slate-600">
            OtoPiyasa bir üniversite bitirme projesidir; ticari değildir. İlan verileri
            kaynak sitelerden yalnızca akademik amaçla derlenmiştir ve tüm hakları
            kaynaklarına aittir — her ilan orijinal kaynağına bağlantı verir.
          </p>
          <p className="container mt-2 text-center text-xs text-slate-600">
            <Link href="/gizlilik" className="hover:text-amber-300 hover:underline">
              Gizlilik Politikası
            </Link>
          </p>
        </footer>
        <CompareTray />
        <ChatWidget />
      </body>
    </html>
  );
}
