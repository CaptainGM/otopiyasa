import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { clusterKeyFor, buildMapQuery, distanceKm } from "@/lib/map-clusters";

export const dynamic = "force-dynamic";

/** Bir haritada bir işarete tıklandığında gösterilecek ilan sayısı. */
const POPUP_LIMIT = 100;

interface LeanCar {
  _id: { toString(): string };
  title: string;
  brand: string;
  model?: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  address?: string;
  description?: string;
  imageUrl: string;
  sourceSite?: string;
  features?: { fuelType?: string; transmission?: string };
  priceHistory?: { price: number; recordedAt: string }[];
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
    const sortParam = params.get("sort") || "price_asc";
    const sortObj: Record<string, 1 | -1> =
      sortParam === "price_desc"
        ? { price: -1 }
        : sortParam === "year_desc"
        ? { year: -1 }
        : sortParam === "mileage_asc"
        ? { mileage: 1 }
        : sortParam === "newest"
        ? { _id: -1 }
        : { price: 1 };

    const cars = (await Car.find(query, {
      title: 1,
      brand: 1,
      model: 1,
      year: 1,
      price: 1,
      mileage: 1,
      city: 1,
      address: 1,
      description: 1,
      imageUrl: 1,
      sourceSite: 1,
      "features.fuelType": 1,
      "features.transmission": 1,
      priceHistory: 1,
    })
      .sort(sortObj)
      .lean()) as unknown as LeanCar[];

    // scope=city → haritada uzaklaşılmış, ilçe kümeleri il düzeyinde
    // birleştirilmiş demektir; o zaman ŞEHRİN TAMAMI döner. Aksi hâlde başlık
    // "Kocaeli — 183 ilan" derken liste yalnızca ilçesi bilinmeyenleri gösterirdi.
    const wholeCity = params.get("scope") === "city";

    /**
     * "Yakınımdakiler" modu: istemci konumunu ve yarıçapı gönderir; yarıçap
     * DIŞINDAKİ ilanlar listeden tamamen çıkarılır.
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
          if (!placed || placed.level !== "district") return false;
          if (distanceKm(me, placed) > radius) return false;
          return true;
        }
        return wholeCity || placed?.key.normalize("NFC") === normalizedKey;
      })
      .slice(0, POPUP_LIMIT)
      .map((car) => {
        const history = car.priceHistory || [];
        const hasDropped =
          history.length > 1 && history[0].price > car.price;
        const dropAmount = hasDropped ? history[0].price - car.price : 0;

        return {
          _id: car._id.toString(),
          title: car.title,
          brand: car.brand,
          model: car.model || "",
          year: car.year,
          price: car.price,
          mileage: car.mileage,
          city: car.city,
          address: car.address || "",
          imageUrl: car.imageUrl,
          sourceSite: car.sourceSite || "arabam",
          fuelType: car.features?.fuelType || "Bilinmiyor",
          transmission: car.features?.transmission || "Manuel",
          hasDropped,
          dropAmount,
        };
      });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/map/cars error:", error);
    return NextResponse.json({ error: "İlanlar alınamadı." }, { status: 500 });
  }
}
