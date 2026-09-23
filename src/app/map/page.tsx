import Link from "next/link";
import { ListingsMap } from "@/components/ListingsMap";

export const metadata = {
  title: "Harita | OtoPiyasa",
  description: "Satılık araç ilanlarını Türkiye haritası üzerinde keşfedin.",
};

export const revalidate = 300;

/**
 * Harita verisi artık sunucu bileşeninden DEĞİL, `/api/map` üzerinden KÜMELENMİŞ
 * olarak gelir. Eskiden 5511 ilanın tamamı (başlık/görsel/fiyat) sayfaya gömülüp
 * 5511 Leaflet işareti çiziliyordu; sayfa bu yüzden çok ağırdı.
 */
export default async function MapPage() {
  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300 mb-2">
            <span>🗺️</span>
            <span>İnteraktif Bölgesel Vitrin</span>
          </div>
          <h1 className="text-3xl font-black text-white">İlan Haritası</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Türkiye genelindeki satılık araçları harita üzerinde keşfedin. İl kümelerine tıklayarak ilçelere yakınlaşabilir, dilediğiniz bölgedeki araçları sağdaki vitrin çekmecesinde filtreleyip listeleyebilirsiniz.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1 text-xs font-bold shadow-lg">
          <Link
            href="/"
            className="rounded-lg px-4 py-1.5 text-slate-400 transition hover:text-white"
          >
            Liste Görünümü
          </Link>
          <span className="rounded-lg bg-amber-400/20 px-4 py-1.5 text-amber-300 font-extrabold border border-amber-400/40 shadow-sm">
            Harita
          </span>
        </div>
      </div>
      <ListingsMap />
    </div>
  );
}
