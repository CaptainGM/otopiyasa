import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { clusterKeyFor, buildMapQuery, distanceKm } from "@/lib/map-clusters";

export const dynamic = "force-dynamic";

/** Bir haritada bir işarete tıklandığında gösterilecek ilan sayısı. */
const POPUP_LIMIT = 40;

interface LeanCar {
  _id: { toString(): string };
  title: string;
  brand: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  address?: string;
  description?: string;
  imageUrl: string;
  features?: { fuelType?: string };
}

/**
 * Tek bir harita kümesindeki ilanlar. Küme anahtarı "il|ilçe" biçiminde gelir
 * (bkz. lib/map-clusters.ts); ilçe boşsa yalnızca il bilgisi olan ilanlardır.
 *
 * Harita ilk yüklemede ilanları HİÇ indirmez; bu uç nokta yalnızca kullanıcı bir
 * işarete tıkladığında çağrılır.
 */
export async function GET(request: Request) {
  try {
    await connectDB();
    const params = new URL(request.url).searchParams;
    const key = params.get("key");
    if (!key) {
      return NextResponse.json({ error: "Küme anahtarı gerekli." }, { status: 400 });
    }

    // Türkçe harfler (İ, ş…) farklı Unicode gösterimleriyle gelebilir
    // (URL/kopyala-yapıştır kaynaklı); NFC'ye normalleştirilmezse şehir eşleşmez.
    const normalizedKey = key.normalize("NFC");
    const [city] = normalizedKey.split("|");
    const query = { ...buildMapQuery(params), city };

    // Şehir bazında daralt, ardından küme anahtarına göre ele. Bir şehirdeki ilan
    // sayısı sınırlı olduğu için bu adım ucuz.
    // `description` kümeleme sırasında konum çıkarımı için gerekiyor; /api/map
    // ile AYNI alanlar gelmezse burada hesaplanan küme anahtarı farklı çıkar ve
    // popup "İlan bulunamadı" derdi.
    const cars = (await Car.find(query, {
      title: 1,
      brand: 1,
      year: 1,
      price: 1,
      mileage: 1,
      city: 1,
      address: 1,
      description: 1,
      imageUrl: 1,
      "features.fuelType": 1,
    })
      .sort({ price: 1 })
      .lean()) as unknown as LeanCar[];

    // scope=city → haritada uzaklaşılmış, ilçe kümeleri il düzeyinde
    // birleştirilmiş demektir; o zaman ŞEHRİN TAMAMI döner. Aksi hâlde başlık
    // "Kocaeli — 183 ilan" derken liste yalnızca ilçesi bilinmeyenleri gösterirdi.
    const wholeCity = params.get("scope") === "city";

    /**
     * "Yakınımdakiler" modu: istemci konumunu ve yarıçapı gönderir; yarıçap
     * DIŞINDAKİ ilanlar listeden tamamen çıkarılır.
     *
     * Neden gerekli: küme filtresi tek başına yetmiyor. Bir küme il düzeyindeyse
     * (ilçesi bilinmeyen ilanlar) o kümedeki araçlar ilin herhangi bir yerinde
     * olabilir; "10 km içinde" diye göstermek yanlış olur. Aynı şekilde
     * scope=city ile şehrin tamamı istendiğinde de uzaktakiler elenmeli.
     */
    const nearParam = params.get("near");
    const radiusKm = Number(params.get("radiusKm"));
    const me = (() => {
      if (!nearParam) return null;
      const [lat, lng] = nearParam.split(",").map(Number);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    })();
    const radius = me && Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : null;

    const items = cars
      .filter((car) => {
        const placed = clusterKeyFor(car);
        if (me && radius) {
          // Konumu yalnızca il düzeyinde bilinenler "yakında" sayılamaz.
          if (!placed || placed.level !== "district") return false;
          if (distanceKm(me, placed) > radius) return false;
          return true;
        }
        return wholeCity || placed?.key.normalize("NFC") === normalizedKey;
      })
      .slice(0, POPUP_LIMIT)
      .map((car) => ({
        _id: car._id.toString(),
        title: car.title,
        brand: car.brand,
        year: car.year,
        price: car.price,
        mileage: car.mileage,
        city: car.city,
        address: car.address || "",
        imageUrl: car.imageUrl,
        fuelType: car.features?.fuelType || "Bilinmiyor",
      }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/map/cars error:", error);
    return NextResponse.json({ error: "İlanlar alınamadı." }, { status: 500 });
  }
}
