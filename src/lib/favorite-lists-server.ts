import { Types } from "mongoose";
import { User } from "@/models/User";
import { FavoriteMeta } from "@/models/FavoriteMeta";
import { serializeFavoriteLists, type FavoriteListDTO } from "@/lib/favorite-lists";

export type UserFavoriteState = {
  favorites?: Types.ObjectId[];
  favoriteLists?: { _id: Types.ObjectId; name?: string; carIds?: Types.ObjectId[] }[];
} | null;

/** Kullanıcının favori kimlikleri ve ham listeleri. */
export async function loadFavoriteState(userId: string): Promise<UserFavoriteState> {
  return User.findById(userId).select("favorites favoriteLists").lean<UserFavoriteState>();
}

/** Varsayılan liste + kendi listeleri, istemciye gidecek biçimde. */
export async function loadSerializedLists(userId: string): Promise<FavoriteListDTO[]> {
  const state = await loadFavoriteState(userId);
  return serializeFavoriteLists(state?.favoriteLists, state?.favorites);
}

/**
 * Dizi güncellemeleri ($[]) alan hiç yoksa MongoDB'de hata verir ("path must exist"); listesi olmayan eski kullanıcılar için
 * bu güncellemeler yalnızca en az bir listesi varsa çalıştırılır.
 */
const HAS_LISTS = { "favoriteLists.0": { $exists: true } };

/** İlanı kullanıcının tüm kendi listelerinden (isteğe bağlı bir liste hariç) çıkarır; favorilerde kalır. */
export async function pullCarFromLists(userId: string, carIds: string[], exceptListId?: Types.ObjectId): Promise<void> {
  await User.updateOne(
    { _id: userId, ...HAS_LISTS },
    { $pull: { "favoriteLists.$[other].carIds": { $in: carIds } } },
    { arrayFilters: [exceptListId ? { "other._id": { $ne: exceptListId } } : { "other._id": { $exists: true } }] }
  );
}

/**
 * İlanı tek bir listeye koyar (favorilerde değilse favorilere de ekler). Bir ilan aynı anda yalnızca tek listededir;
 * bu yüzden önce öteki listelerden çıkarılır. listId "default" ya da boşsa ilan varsayılan listeye taşınır.
 */
export async function placeCarInList(userId: string, carId: string, listId: string | null): Promise<void> {
  const customId = listId && Types.ObjectId.isValid(listId) ? new Types.ObjectId(listId) : null;
  await pullCarFromLists(userId, [carId], customId || undefined);
  if (customId) {
    await User.updateOne(
      { _id: userId, ...HAS_LISTS },
      { $addToSet: { "favoriteLists.$[target].carIds": carId } },
      { arrayFilters: [{ "target._id": customId }] }
    );
  }
  await User.updateOne({ _id: userId }, { $addToSet: { favorites: carId } });
}

/** Favoriden tamamen çıkarır: listelerden, favorilerden ve not/bildirim ayarından. */
export async function removeFavorites(userId: string, carIds: string[]): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { favorites: { $in: carIds } } });
  await pullCarFromLists(userId, carIds);
  await FavoriteMeta.deleteMany({ userId, carId: { $in: carIds } });
}
