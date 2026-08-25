import { Subscription } from "@/models/Subscription";
import { appBaseUrl } from "@/lib/app-url";
import { Car } from "@/models/Car";
import { connectDB } from "@/lib/mongodb";
import { sendEmail } from "@/lib/mailer";
import { shouldNotifySegmentAlert } from "@/lib/segment-alert";

interface SubscriptionDoc {
  _id: unknown;
  email: string;
  brand?: string | null;
  model?: string | null;
  yearMin?: number | null;
  yearMax?: number | null;
  maxPrice?: number | null;
  targetAvgPrice?: number | null;
  lastNotifiedAt?: Date | null;
}

async function checkNewListingSubscription(sub: SubscriptionDoc) {
  const query: Record<string, unknown> = {};
  if (sub.brand) query.brand = sub.brand;
  if (sub.model) query.model = sub.model;
  if (sub.yearMin || sub.yearMax) {
    const year: Record<string, number> = {};
    if (sub.yearMin) year.$gte = sub.yearMin;
    if (sub.yearMax) year.$lte = sub.yearMax;
    query.year = year;
  }
  if (sub.maxPrice) query.price = { $lte: sub.maxPrice };

  const since = sub.lastNotifiedAt ? new Date(sub.lastNotifiedAt) : new Date(Date.now() - 1000 * 60 * 60 * 24);
  query.createdAt = { $gt: since };

  const matches = await Car.find(query).limit(20).lean<{ _id: unknown; title: string; year: number; city: string; price: number }[]>();
  if (matches.length === 0) return;

  const appUrl = appBaseUrl();
  const rows = matches
    .map(
      (m) =>
        `<li style="margin-bottom:8px"><a href="${appUrl}/cars/${m._id}" style="font-weight:bold">${m.title}</a><br/>${m.year} • ${m.city} • <strong style="color:#059669">${m.price.toLocaleString("tr-TR")} TL</strong></li>`
    )
    .join("");
  const html = `<p>Kayıtlı aramanla eşleşen <strong>${matches.length} yeni ilan</strong> bulundu:</p><ul style="padding-left:18px">${rows}</ul><p style="color:#888;font-size:12px">Bu bildirimi OtoPiyasa'da araç aboneliği oluşturduğun için aldın.</p>`;
  const text = matches
    .map((m) => `- ${m.title} (${m.year}) ${m.price.toLocaleString("tr-TR")} TL — ${appUrl}/cars/${m._id}`)
    .join("\n");

  try {
    await sendEmail({ to: sub.email, subject: `OtoPiyasa - ${matches.length} yeni araç eşleşmesi`, html, text });
    await Subscription.updateOne({ _id: sub._id }, { $set: { lastNotifiedAt: new Date() } });
  } catch (err) {
    console.error("Failed to send subscription email for", sub._id, err);
  }
}


async function getSegmentAverage(brand: string, model?: string | null) {
  const match: Record<string, unknown> = { brand };
  if (model) match.model = model;
  const [row] = await Car.aggregate([
    { $match: match },
    { $group: { _id: null, avgPrice: { $avg: "$price" }, count: { $sum: 1 } } },
  ]);
  return { avgPrice: row?.avgPrice ?? null, count: row?.count ?? 0 };
}

async function checkSegmentAlertSubscription(sub: SubscriptionDoc) {
  if (!sub.brand || !sub.targetAvgPrice) return;

  const { avgPrice, count } = await getSegmentAverage(sub.brand, sub.model);
  const notify = shouldNotifySegmentAlert({
    currentAvgPrice: avgPrice,
    targetAvgPrice: sub.targetAvgPrice,
    sampleCount: count,
    lastNotifiedAt: sub.lastNotifiedAt ?? null,
  });
  if (!notify) return;

  const appUrl = appBaseUrl();
  const segmentLabel = sub.model ? `${sub.brand} ${sub.model}` : sub.brand;
  const roundedAvg = Math.round(avgPrice as number).toLocaleString("tr-TR");
  const target = sub.targetAvgPrice.toLocaleString("tr-TR");
  const link = `${appUrl}/?brand=${encodeURIComponent(sub.brand)}${sub.model ? `&model=${encodeURIComponent(sub.model)}` : ""}`;
  const html = `<p><strong>${segmentLabel}</strong> segmentinin ortalama fiyatı <strong style="color:#059669">${roundedAvg} TL</strong>'ye düştü (hedefin: ${target} TL, ${count} ilan üzerinden).</p><p><a href="${link}">İlanları gör →</a></p>`;
  const text = `${segmentLabel} ortalaması ${roundedAvg} TL'ye düştü (hedef ${target} TL, ${count} ilan). ${link}`;

  try {
    await sendEmail({ to: sub.email, subject: `OtoPiyasa - ${segmentLabel} ortalama fiyat alarmı`, html, text });
    await Subscription.updateOne({ _id: sub._id }, { $set: { lastNotifiedAt: new Date() } });
  } catch (err) {
    console.error("Failed to send segment alert email for", sub._id, err);
  }
}

export async function checkSubscriptions() {
  await connectDB();
  const subs = await Subscription.find({ active: true }).lean<SubscriptionDoc[]>();

  for (const sub of subs) {
    if (sub.targetAvgPrice) {
      await checkSegmentAlertSubscription(sub);
    } else {
      await checkNewListingSubscription(sub);
    }
  }
}

export default { checkSubscriptions };
