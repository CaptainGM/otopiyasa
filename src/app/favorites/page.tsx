import Link from "next/link";
import { redirect } from "next/navigation";
import { CarCard } from "@/components/CarCard";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { isLeanCarDoc, attachMarketToCars } from "@/lib/serialize-car";
import { getMarketMap } from "@/lib/market-price";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { Car as CarType } from "@/types";

function isUserWithFavorites(
  value: unknown
): value is { favorites: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "favorites" in value &&
    Array.isArray((value as { favorites: unknown }).favorites)
  );
}

export default async function FavoritesPage() {
  const authUser = await getCurrentUser();
  if (!authUser) {
    redirect("/login");
  }

  await connectDB();
  const user = await User.findById(authUser.userId).populate("favorites").lean();

  let favorites: CarType[] = [];
  if (isUserWithFavorites(user)) {
    const docs = (user.favorites as unknown[]).filter(isLeanCarDoc);
    const marketMap = await getMarketMap(
      docs.map((car) => ({
        brand: car.brand,
        model: car.model,
        year: car.year,
      }))
    );
    favorites = attachMarketToCars(docs, marketMap);
  }

  const recommendations = await getRecommendationsForUser(authUser.userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Favorilerim</h1>
        <p className="text-slate-500">Kaydettiğin araçları buradan takip edebilirsin.</p>
      </div>

      {favorites.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-slate-500">Henüz favori eklemedin.</p>
          <Link href="/" className="mt-4 inline-block text-blue-700 hover:underline">
            İlanlara git
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((car) => (
            <CarCard key={car._id} car={car} />
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-4 pt-6">
          <div>
            <h2 className="text-2xl font-bold">Sana özel öneriler</h2>
            <p className="text-sm text-slate-500">
              Favorilerine benzer marka, model ve fiyat aralığındaki ilanlar.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((car) => (
              <CarCard key={car._id} car={car} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
