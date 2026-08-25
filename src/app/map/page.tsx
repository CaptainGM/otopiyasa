import Link from "next/link";
import { ListingsMap } from "@/components/ListingsMap";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "Harita | OtoPiyasa",
  description: "Satılık araç ilanlarını Türkiye haritası üzerinde keşfedin.",
};

export const dynamic = "force-dynamic";

/**
 * Harita verisi artık sunucu bileşeninden DEĞİL, `/api/map` üzerinden KÜMELENMİŞ
 * olarak gelir. Eskiden 5511 ilanın tamamı (başlık/görsel/fiyat) sayfaya gömülüp
 * 5511 Leaflet işareti çiziliyordu; sayfa bu yüzden çok ağırdı.
 */
export default async function MapPage() {
  await getCurrentUser();

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">İlan Haritası</h1>
          <p className="mt-1 max-w-3xl text-slate-400">
            İlanlar bulundukları ilçenin merkezinde gruplanır — işarete tıklayıp
            içindeki ilanları gör. İlçe bilgisi olmayan ilanlar il merkezinde
            toplanır. Konumunu paylaşırsan sana en yakın ilanlar öne çıkar.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-full border border-white/10 text-xs font-bold">
          <Link
            href="/"
            className="px-3 py-1.5 text-slate-400 transition hover:bg-white/5 hover:text-[var(--text)]"
          >
            Liste
          </Link>
          <span className="bg-amber-400/15 px-3 py-1.5 text-amber-300">Harita</span>
        </div>
      </div>
      <ListingsMap />
    </div>
  );
}
