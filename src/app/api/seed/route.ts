import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { applySeedImages } from "@/lib/car-images";
import { seedCars } from "@/lib/seed-data";
import { requireAdmin } from "@/lib/auth";

/**
 * Boş bir kuruluma demo araç yükler (ilk kurulum / sunum ortamı için).
 *
 * GÜVENLİK GEÇMİŞİ: Bu uç nokta eskiden ilk iş olarak `Car.deleteMany({})`
 * çağırıyordu — yani tek bir POST isteği veritabanındaki TÜM ilanları siliyordu.
 * Şu an canlıda 11.000+ gerçek ilan var ve bunlar haftalarca süren hız-sınırlı
 * taramayla toplandı; Atlas M0'da otomatik yedek YOK. Yanlışlıkla atılacak tek
 * bir istek her şeyi geri dönüşsüz siler.
 *
 * Bugünkü davranış:
 *  - HİÇBİR ŞEY SİLMEZ (toplu silme tamamen kaldırıldı).
 *  - Veritabanında gerçek (demo olmayan) ilan varsa çalışmayı REDDEDER.
 *  - Demo kayıtları `externalId: "demo-N"` ile ekler; tekrar çalıştırılırsa
 *    benzersiz indeks sayesinde çoğaltmaz, var olanı günceller.
 */
export async function POST() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    }

    await connectDB();

    // Gerçek veri varken demo yüklemeyi reddet — kaza korumasının kalbi burası.
    const realCount = await Car.countDocuments({ sourceSite: { $nin: ["demo"] } });
    if (realCount > 0) {
      return NextResponse.json(
        {
          error:
            `Veritabanında ${realCount} gerçek ilan var; demo veri yüklenmedi. ` +
            "Bu uç nokta yalnızca BOŞ bir kurulumda çalışır ve hiçbir kaydı silmez.",
        },
        { status: 409 }
      );
    }

    const cars = applySeedImages(seedCars).map((car, index) => ({
      ...car,
      sourceSite: index % 2 === 0 ? "sahibinden" : "arabam",
      source: index % 2 === 0 ? "sahibinden" : "arabam",
      externalId: `demo-${index + 1}`,
      listingUrl:
        index % 2 === 0
          ? `https://www.sahibinden.com/ilan/demo-${index + 1}`
          : `https://www.arabam.com/ilan/demo-${index + 1}`,
    }));

    // Silip yeniden yazmak yerine upsert: veri kaybı riski olmadan tekrar
    // çalıştırılabilir (idempotent).
    await Car.bulkWrite(
      cars.map((car) => ({
        updateOne: {
          filter: { sourceSite: car.sourceSite, externalId: car.externalId },
          update: { $set: car },
          upsert: true,
        },
      }))
    );

    return NextResponse.json({
      success: true,
      count: cars.length,
      message: `${cars.length} demo araç yüklendi (mevcut kayıtlar silinmedi).`,
    });
  } catch (error) {
    console.error("POST /api/seed error:", error);
    return NextResponse.json(
      { error: "Seed işlemi başarısız oldu." },
      { status: 500 }
    );
  }
}
