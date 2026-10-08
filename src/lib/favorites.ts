import { Types } from "mongoose";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { LIST_IMAGE_LIMIT, isLeanCarDoc, type LeanCarDoc } from "@/lib/serialize-car";
import { serializeFavoriteLists, type FavoriteListDTO } from "@/lib/favorite-lists";
import { FavoriteMeta } from "@/models/FavoriteMeta";
import { removeFavorites } from "@/lib/favorite-lists-server";
import { isDefaultMeta, toMetaDTO, type FavoriteMetaDTO } from "@/lib/favorite-meta";

/**
 * Kullanıcının favorilediği ama artık yayında olmayan (kaynaktan kalkmış ya da satılmış) ilanın MİNİMUM görünümü:
 * yalnızca kullanıcının kaydederken gördüğü başlık ve küçük fotoğraf. Fiyat, açıklama, telefon, bağlantı gibi
 * hiçbir ayrıntı yoktur ve ilan sayfası açılmaz; kart "Kaldırıldı/Satıldı" diye işaretlenir.
 */
export interface UnavailableFavorite {
  _id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  imageUrl: string;
  status: "removed" | "sold";
}

export interface FavoritesResult {
  /** Favori kimliklerinin tamamı (ilan sayfasındaki kalp durumu için). */
  ids: string[];
  /** Varsayılan "Favori Listem" + kullanıcının kendi listeleri (her liste yalnızca ilan kimliklerini taşır). */
  lists: FavoriteListDTO[];
  /** İlan kimliği → not ve bildirim ayarı (yalnızca varsayılandan farklı olanlar). */
  meta: Record<string, FavoriteMetaDTO>;
  /** Herkese açık (aktif + onaylı) favori ilanlar; en son eklenen başta. */
  available: LeanCarDoc[];
  unavailable: UnavailableFavorite[];
}

/** Kullanıcının favorileri için kayıtlı not/bildirim ayarları; varsayılandan farklı olanlar. */
export async function loadMeta(userId: string, carIds: string[]): Promise<Record<string, FavoriteMetaDTO>> {
  if (carIds.length === 0) return {};
  const rows = await FavoriteMeta.find({ userId, carId: { $in: carIds } }).lean<
    Array<{ carId: Types.ObjectId; note?: string; alertMode?: string; alertBelow?: number | null; alertEmail?: boolean; alertPush?: boolean }>
  >();
  const out: Record<string, FavoriteMetaDTO> = {};
  for (const row of rows) {
    const dto = toMetaDTO(row);
    if (!isDefaultMeta(dto)) out[row.carId.toString()] = dto;
  }
  return out;
}

export async function loadFavorites(userId: string): Promise<FavoritesResult> {
  const user = await User.findById(userId)
    .select("favorites favoriteLists")
    .lean<{ favorites?: Types.ObjectId[]; favoriteLists?: { _id: Types.ObjectId; name?: string; carIds?: Types.ObjectId[] }[] } | null>();
  const ids = (user?.favorites || []).map((id) => id.toString());
  const lists = serializeFavoriteLists(user?.favoriteLists, user?.favorites);
  const meta = await loadMeta(userId, ids);
  if (ids.length === 0) return { ids, lists, meta, available: [], unavailable: [] };

  const [publicDocs, otherDocs] = await Promise.all([
    Car.find({ _id: { $in: ids }, ...PUBLIC_LISTING_FILTER })
      .slice("images", LIST_IMAGE_LIMIT)
      .lean(),
    // Yayında olmayanlar: yalnızca denetimden geçmiş ilanların kaldırılmış/satılmış olanları gösterilir
    // (onay bekleyen ya da reddedilen üye ilanı hiçbir biçimde görünmez).
    Car.find(
      {
        _id: { $in: ids },
        status: { $in: ["removed", "sold"] },
        moderationStatus: { $nin: ["pending", "rejected"] },
      },
      { title: 1, brand: 1, model: 1, year: 1, imageUrl: 1, images: { $slice: 1 }, status: 1 }
    ).lean(),
  ]);

  const rank = new Map(ids.map((id, index) => [id, index]));
  const byRecent = (a: string, b: string) => (rank.get(b) ?? 0) - (rank.get(a) ?? 0);

  const available = (publicDocs as unknown[]).filter(isLeanCarDoc);
  available.sort((a, b) => byRecent(a._id.toString(), b._id.toString()));

  const unavailable: UnavailableFavorite[] = (otherDocs as any[])
    .map((doc) => ({
      _id: doc._id.toString(),
      title: String(doc.title || ""),
      brand: String(doc.brand || ""),
      model: String(doc.model || ""),
      year: Number(doc.year) || 0,
      imageUrl: String(doc.imageUrl || doc.images?.[0] || ""),
      status: (doc.status === "sold" ? "sold" : "removed") as "removed" | "sold",
    }))
    .sort((a, b) => byRecent(a._id, b._id));

  // Veritabanından tamamen silinmiş ilanların kimlikleri favori listesinde sonsuza dek kalmasın.
  const known = new Set<string>([...available.map((c) => c._id.toString()), ...unavailable.map((c) => c._id)]);
  const stillExistsHidden = await Car.find({ _id: { $in: ids.filter((id) => !known.has(id)) } }, { _id: 1 }).lean();
  const hiddenIds = new Set(stillExistsHidden.map((doc) => String(doc._id)));
  const gone = ids.filter((id) => !known.has(id) && !hiddenIds.has(id));
  if (gone.length > 0) {
    removeFavorites(userId, gone).catch(() => {});
  }

  return { ids, lists, meta, available, unavailable };
}
