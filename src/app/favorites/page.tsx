import Link from "next/link";
import { redirect } from "next/navigation";
import { CarCard } from "@/components/CarCard";
import { UnavailableFavoriteCard } from "@/components/UnavailableFavoriteCard";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { attachMarketToCars } from "@/lib/serialize-car";
import { getMarketMap } from "@/lib/market-price";
import { loadFavorites, type UnavailableFavorite } from "@/lib/favorites";
import { Car as CarType } from "@/types";
import { serializeCarListItem } from "@/lib/serialize-car-list-item";

export default async function FavoritesPage() {
  const authUser = await getCurrentUser();
  if (!authUser) {
    redirect("/login");
  }

  let favorites: CarType[] = [];
  let unavailable: UnavailableFavorite[] = [];
  try {
    await connectDB();
    const result = await loadFavorites(authUser.userId);
    unavailable = result.unavailable;
    if (result.available.length > 0) {
      const marketMap = await getMarketMap(
        result.available.map((car) => ({ brand: car.brand, model: car.model, year: car.year }))
      );
      favorites = attachMarketToCars(result.available, marketMap);
    }
  } catch (err) {
    console.error("Favoriler yüklenirken hata:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Favorilerim</h1>
        <p className="text-slate-500">Kaydettiğin araçları buradan takip edebilirsin.</p>
      </div>

      {favorites.length === 0 && unavailable.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-slate-500">Henüz favori eklemedin.</p>
          <Link href="/" className="mt-4 inline-block text-blue-700 hover:underline">
            İlanlara git
          </Link>
        </div>
      ) : (
        <>
          {favorites.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {favorites.map((car) => (
                <CarCard key={car._id} car={serializeCarListItem(car)} />
              ))}
            </div>
          )}

          {unavailable.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-300">Artık yayında olmayan ilanlar</h2>
              <p className="text-sm text-slate-500">
                Bu ilanlar satıldı ya da kaynağından kaldırıldı. Ayrıntıları gösterilmez; istersen favorilerden çıkarabilirsin.
              </p>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {unavailable.map((item) => (
                  <UnavailableFavoriteCard key={item._id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
