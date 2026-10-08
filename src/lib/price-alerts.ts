import { User } from "@/models/User";
import { FavoriteMeta } from "@/models/FavoriteMeta";
import { appBaseUrl } from "@/lib/app-url";
import { isMailerConfigured, sendPriceDropEmail } from "@/lib/mailer";
import { isPushConfigured, sendPushToUsers } from "@/lib/web-push";
import { createNotification } from "@/lib/notify";
import { alertChannels, toMetaDTO } from "@/lib/favorite-meta";
import { formatPrice } from "@/lib/utils";

/**
 * Favorideki bir ilanın fiyatı düştüğünde kullanıcıya haber verir. Her kullanıcı ilan başına seçebilir
 * (bkz. models/FavoriteMeta.ts): her düşüşte / belirlediği fiyatın altına düşünce / hiç; e-posta, mobil bildirim ya da ikisi.
 * Ayarı olmayan favori eski davranışı sürdürür: her düşüşte e-posta + bildirim.
 */
export async function notifyFavoritePriceDrop(car: {
  _id: { toString(): string };
  title: string;
  price: number;
}, oldPrice: number) {
  const users = await User.find({ favorites: car._id })
    .select("_id email name")
    .lean<{ _id: { toString(): string }; email?: string; name?: string }[]>();
  if (users.length === 0) return;

  const metas = await FavoriteMeta.find({ carId: car._id, userId: { $in: users.map((u) => u._id) } }).lean<
    Array<{ userId: { toString(): string } }>
  >();
  const metaByUser = new Map(metas.map((m) => [m.userId.toString(), toMetaDTO(m as never)]));

  const emailTo: typeof users = [];
  const pushTo: typeof users = [];
  const inApp: typeof users = [];
  for (const user of users) {
    const channels = alertChannels(metaByUser.get(user._id.toString()) ?? toMetaDTO(null), car.price);
    if (channels.email) emailTo.push(user);
    if (channels.push) pushTo.push(user);
    if (channels.email || channels.push) inApp.push(user);
  }
  if (inApp.length === 0) return;

  const appUrl = appBaseUrl();
  const url = `${appUrl}/cars/${car._id.toString()}`;

  if (isMailerConfigured()) {
    for (const user of emailTo) {
      if (!user.email) continue;
      try {
        await sendPriceDropEmail(user.email, {
          title: car.title,
          oldPrice: formatPrice(oldPrice),
          newPrice: formatPrice(car.price),
          url,
        });
      } catch (error) {
        console.error(`Fiyat e-postası gönderilemedi (${user.email}):`, error);
      }
    }
  }

  if (isPushConfigured() && pushTo.length > 0) {
    try {
      const sent = await sendPushToUsers(
        pushTo.map((u) => u._id),
        {
          title: "Fiyat düştü 📉",
          body: `${car.title}: ${formatPrice(oldPrice)} → ${formatPrice(car.price)}`,
          url: `/cars/${car._id.toString()}`,
        }
      );
      if (sent > 0) console.log(`Fiyat düşüşü push: ${sent} cihaza gönderildi.`);
    } catch (error) {
      console.error("Fiyat düşüşü push gönderilemedi:", error);
    }
  }

  // Bildirimler ekranında da görünsün (push gitmese ya da kapalı olsa bile).
  for (const user of inApp) {
    await createNotification({
      userId: user._id.toString(),
      type: "listing",
      title: "Favori ilanının fiyatı düştü",
      body: `${car.title}: ${formatPrice(oldPrice)} → ${formatPrice(car.price)}`,
      link: `/cars/${car._id.toString()}`,
    });
  }

  console.log(`Fiyat düşüşü bildirimi: "${car.title}" için ${inApp.length} kullanıcı işlendi.`);
}
