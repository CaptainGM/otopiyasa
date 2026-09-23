import Link from "next/link";
import { redirect } from "next/navigation";
import { CarCard } from "@/components/CarCard";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { isLeanCarDoc, attachMarketToCars } from "@/lib/serialize-car";
import { getMarketMap } from "@/lib/market-price";
import { Car as CarType } from "@/types";
import { serializeCarListItem } from "@/lib/serialize-car-list-item";

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

  let favorites: CarType[] = [];
  try {
    await connectDB();
    const user = await User.findById(authUser.userId)
      .select("favorites")
      .populate({
        path: "favorites",
        match: { status: "active" },
      })
      .lean();

    if (isUserWithFavorites(user)) {
      const rawDocs = (user.favorites as unknown[]).filter(isLeanCarDoc);
      if (rawDocs.length > 0) {
        const marketMap = await getMarketMap(
          rawDocs.map((car) => ({
            brand: car.brand,
            model: car.model,
            year: car.year,
          }))
        );
        favorites = attachMarketToCars(rawDocs, marketMap);
      }
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
            <CarCard key={car._id} car={serializeCarListItem(car)} />
          ))}
        </div>
      )}
    </div>
  );
}
