import { User } from "@/models/User";
import { appBaseUrl } from "@/lib/app-url";
import { isMailerConfigured, sendPriceDropEmail } from "@/lib/mailer";
import { isPushConfigured, sendPushToUsers } from "@/lib/web-push";
import { formatPrice } from "@/lib/utils";


export async function notifyFavoritePriceDrop(car: {
  _id: { toString(): string };
  title: string;
  price: number;
}, oldPrice: number) {
 
  if (!isMailerConfigured() && !isPushConfigured()) return;

  const users = await User.find({ favorites: car._id })
    .select("_id email name")
    .lean<{ _id: { toString(): string }; email?: string; name?: string }[]>();
  if (users.length === 0) return;

  const appUrl = appBaseUrl();
  const url = `${appUrl}/cars/${car._id.toString()}`;


  if (isMailerConfigured()) {
    for (const user of users) {
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


  if (isPushConfigured()) {
    try {
      const sent = await sendPushToUsers(
        users.map((u) => u._id),
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

  console.log(
    `Fiyat düşüşü bildirimi: "${car.title}" için ${users.length} kullanıcı işlendi.`
  );
}
