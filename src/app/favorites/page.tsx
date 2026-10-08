import Link from "next/link";
import { redirect } from "next/navigation";
import { CarCard } from "@/components/CarCard";
import { FavoritesBoard, type BoardItem } from "@/components/FavoritesBoard";
import { UnavailableFavoriteCard } from "@/components/UnavailableFavoriteCard";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { attachMarketToCars } from "@/lib/serialize-car";
import { getMarketMap } from "@/lib/market-price";
import { loadFavorites, type UnavailableFavorite } from "@/lib/favorites";
import type { FavoriteListDTO } from "@/lib/favorite-lists";
import type { FavoriteMetaDTO } from "@/lib/favorite-meta";
import { Car as CarType } from "@/types";
import { serializeCarListItem } from "@/lib/serialize-car-list-item";

export default async function FavoritesPage() {
  const authUser = await getCurrentUser();
  if (!authUser) {
    redirect("/login");
  }

  let favorites: CarType[] = [];
  let unavailable: UnavailableFavorite[] = [];
  let lists: FavoriteListDTO[] = [];
  let meta: Record<string, FavoriteMetaDTO> = {};
  try {
    await connectDB();
    const result = await loadFavorites(authUser.userId);
    unavailable = result.unavailable;
    lists = result.lists;
    meta = result.meta;
    if (result.available.length > 0) {
      const marketMap = await getMarketMap(
        result.available.map((car) => ({ brand: car.brand, model: car.model, year: car.year }))
      );
      favorites = attachMarketToCars(result.available, marketMap);
    }
  } catch (err) {
    console.error("Favoriler yüklenirken hata:", err);
  }

  const items: BoardItem[] = [
    ...favorites.map((car) => {
      const item = serializeCarListItem(car);
      return {
        id: car._id,
        node: <CarCard car={item} />,
        cover: item.imageUrl || item.images?.[0],
        price: car.price,
      };
    }),
    ...unavailable.map((item) => ({
      id: item._id,
      node: <UnavailableFavoriteCard item={item} />,
      cover: item.imageUrl,
      unavailable: true,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Favorilerim</h1>
        <p className="text-slate-500">
          Kaydettiğin araçlar listelerde durur. İstediğin kadar liste açıp ilanları sedan, SUV gibi ayırabilir, her ilana not ve
          fiyat bildirimi ekleyebilirsin.
        </p>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-slate-500">
          Henüz favori eklemedin.{" "}
          <Link href="/" className="text-blue-700 hover:underline">
            İlanlara git
          </Link>
        </p>
      )}
      <FavoritesBoard initialLists={lists} initialMeta={meta} items={items} />
    </div>
  );
}
