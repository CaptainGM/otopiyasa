// Eski kullanıcılara "OtoPiyasa yeni adresine taşındı" bilgisini TEK SEFER e-postayla yollar.
//   npx tsx scripts/notify-domain-change.ts                       → yalnızca önizleme (kime gidecek, e-posta metni); HİÇBİR ŞEY GÖNDERMEZ
//   npx tsx scripts/notify-domain-change.ts --gonder              → gönderir
//   npx tsx scripts/notify-domain-change.ts --gonder --haric a@x.com,b@y.com   → bu adresleri atlar
// Kurallar: yalnızca e-postasını doğrulamış, normal (admin olmayan) hesaplar; test adresleri (.local) atlanır; aynı kişiye ikinci kez
// gitmez (User.domainNoticeAt). Posta sağlayıcısının günlük kotası sınırlı olduğu için gönderim arasında bekler.
import { loadEnv } from "./load-env";

loadEnv();

const NEW_URL = "https://otopiyasa.app";

const mask = (email: string) => {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
};

async function main() {
  const { connectDB } = await import("@/lib/mongodb");
  const { User } = await import("@/models/User");
  const { Car } = await import("@/models/Car");
  const { sendEmail, escapeHtml, isMailerConfigured } = await import("@/lib/mailer");
  const { default: mongoose } = await import("mongoose");

  const send = process.argv.includes("--gonder");
  const excludeArg = process.argv.indexOf("--haric");
  const excluded = new Set(
    (excludeArg > 0 ? process.argv[excludeArg + 1] || "" : "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  await connectDB();
  const users = await User.find({
    emailVerified: true,
    role: { $ne: "admin" },
    $or: [{ domainNoticeAt: { $exists: false } }, { domainNoticeAt: null }],
  })
    .select("name email")
    .sort({ createdAt: 1 })
    .lean<Array<{ _id: unknown; name: string; email: string }>>();

  const recipients = users.filter((u) => u.email && !u.email.endsWith(".local") && !excluded.has(u.email.toLowerCase()));
  const activeCount = await Car.countDocuments({ status: "active" });
  const activeText = `${(Math.floor(activeCount / 1000) * 1000).toLocaleString("tr-TR")}+`;

  const build = (name: string) => {
    const first = escapeHtml(String(name || "").trim().split(/\s+/)[0] || "merhaba");
    const html = `<p>Merhaba ${first},</p>
<p>OtoPiyasa'ya kayıt olduğun için seni haberdar etmek istedik: eski adresimiz (otopiyasa.vercel.app) barındırma sınırları yüzünden kapandı. Site artık yeni adresinde:</p>
<p><a href="${NEW_URL}" style="font-weight:700">${NEW_URL}</a></p>
<p>Hesabın ve favorilerin olduğu gibi duruyor; aynı e-posta ve şifrenle giriş yapabilirsin.</p>
<p>Bu arada site epey gelişti: ${activeText} güncel ilan, ilanlar için piyasa karşılaştırması ve fiyat tahmini, favori listeleri ve fiyat düşüşü bildirimi artık hazır.</p>
<p style="color:#888;font-size:12px">Bu, adres değişikliği için gönderilen tek seferlik bir bilgilendirmedir; başka e-posta göndermeyeceğiz.</p>`;
    const text = `Merhaba,\n\nOtoPiyasa'nın eski adresi (otopiyasa.vercel.app) kapandı. Site artık ${NEW_URL} adresinde. Hesabın ve favorilerin aynen duruyor; aynı e-posta ve şifrenle giriş yapabilirsin.\n\nBu, adres değişikliği için tek seferlik bir bilgilendirmedir.`;
    return { subject: "OtoPiyasa yeni adresine taşındı: otopiyasa.app", html, text };
  };

  console.log(`\nAlıcı sayısı: ${recipients.length} (doğrulanmış, admin olmayan, daha önce bilgilendirilmemiş)`);
  for (const u of recipients) console.log(`  - ${u.name} <${mask(u.email)}>`);
  const preview = build(recipients[0]?.name || "Ayşe");
  console.log(`\nKonu: ${preview.subject}\n\n${preview.text}\n`);

  if (!send) {
    console.log("ÖNİZLEME: hiçbir e-posta gönderilmedi. Göndermek için --gonder ekle (istemediklerini --haric ile ayır).");
  } else if (!isMailerConfigured()) {
    console.log("HATA: SMTP ayarları yok, gönderilemedi.");
  } else {
    let ok = 0;
    for (const u of recipients) {
      const mail = build(u.name);
      try {
        await sendEmail({ to: u.email, ...mail });
        await User.updateOne({ _id: u._id }, { $set: { domainNoticeAt: new Date() } });
        ok++;
        console.log(`  ✓ ${mask(u.email)}`);
      } catch (err) {
        console.log(`  ✗ ${mask(u.email)}: ${err instanceof Error ? err.message : err}`);
        break; // kota/bağlantı sorunu: devam edip hepsini hataya düşürme, sonra kaldığı yerden sürer
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    console.log(`\n${ok}/${recipients.length} e-posta gönderildi.`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
