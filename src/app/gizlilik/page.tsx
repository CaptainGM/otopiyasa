import Link from "next/link";

export const metadata = {
  title: "Gizlilik Politikası | OtoPiyasa",
  description:
    "OtoPiyasa hangi verileri topluyor, neden topluyor, nerede saklıyor ve kullanıcı hakları nelerdir.",
};

/**
 * GİZLİLİK POLİTİKASI.
 *
 * Neden gerekli: (1) kayıt/e-posta/telefon gibi kişisel veri işleniyor, KVKK
 * kapsamında aydınlatma yükümlülüğü var; (2) mobil uygulama Google Play'e
 * yüklenecekse herkese açık bir gizlilik politikası ADRESİ zorunlu.
 *
 * Metin bilinçli olarak sade: gerçekte ne yaptığımızı anlatıyor, olmayan bir
 * şeyi vaat etmiyor (ör. reklam ağı, üçüncü tarafa veri satışı yok).
 */
export default function PrivacyPage() {
  const updated = "29 Temmuz 2026";

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div>
        <Link href="/" className="text-sm text-amber-300 hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Gizlilik Politikası</h1>
        <p className="mt-1 text-sm text-slate-400">Son güncelleme: {updated}</p>
      </div>

      <Section title="Kısaca">
        <p>
          OtoPiyasa, akademik amaçlı geliştirilmiş bir üniversite bitirme projesidir.
          Verilerini satmıyoruz, reklam ağlarıyla paylaşmıyoruz ve hesabını istediğin
          zaman sildirebilirsin. Aşağıda hangi veriyi neden tuttuğumuzu tek tek yazdık.
        </p>
      </Section>

      <Section title="Hangi verileri topluyoruz?">
        <List
          items={[
            ["Hesap bilgileri", "Ad soyad, e-posta adresi ve şifren. Şifre asla düz metin olarak saklanmaz; geri döndürülemez şekilde (bcrypt) şifrelenir."],
            ["İlan bilgileri", "İlan verirsen: araç bilgileri, fotoğraflar, konum (il/ilçe) ve iletişim telefonun."],
            ["Etkileşimler", "Favorilerin, verdiğin/aldığın teklifler, teklif sohbetleri, sorduğun sorular ve kayıtlı aramaların."],
            ["Konum (isteğe bağlı)", "Yakınımdakiler özelliğini kullanırsan yaklaşık konumun (enlem/boylam) yakındaki ilanları hesaplamak için sunucuya gönderilir. Bu uç nokta koordinatı uygulama veritabanına kaydetmez; istek web sunucusu ve altyapı günlüklerinde yer alabilir."],
            ["Bildirim izni (isteğe bağlı)", "Tarayıcı bildirimi açarsan, bildirim gönderebilmek için tarayıcının ürettiği abonelik anahtarı."],
          ]}
        />
      </Section>

      <Section title="Telefon numaran ve adın nasıl korunuyor?">
        <p>
          Herkese açık ilan detayında telefon numaran yer almaz. İlan sahibi kendi
          numarasını yönetim ekranında görebilir; alıcıya ise teklif kabul edildiğinde
          teklif sohbetinde gösterilir. Adın soru/yorum alanlarında maskelenir.
        </p>
      </Section>

      <Section title="Verileri neden işliyoruz?">
        <List
          items={[
            ["Hizmeti sunmak", "Giriş yapman, ilan vermen, teklif alıp vermen için."],
            ["Güvenlik", "Sahte hesapları, spam ilanları ve kötüye kullanımı engellemek için (hız sınırı, e-posta doğrulama, içerik denetimi)."],
            ["Bilgilendirme", "Şifre sıfırlama, e-posta doğrulama, teklif/soru bildirimleri ve favori aracında fiyat düşüşü uyarıları."],
          ]}
        />
      </Section>

      <Section title="İlan verileri nereden geliyor?">
        <p>
          Sitedeki ilanların büyük kısmı, karşılaştırma ve araştırma amacıyla halka açık
          kaynaklardan (Arabam.com, Otomerkezi.net) derlenmiştir; bu ilanların sahipleri
          OtoPiyasa üyesi değildir ve bu ilanlara teklif verilemez, soru sorulamaz.
          Üyelerin kendi verdiği ilanlar ayrıca işaretlidir.
        </p>
      </Section>

      <Section title="Verilerini kimlerle paylaşıyoruz?">
        <p className="mb-2">
          Verilerini <strong>satmıyoruz</strong> ve reklam amacıyla paylaşmıyoruz.
          Hizmetin çalışması için yalnızca şu altyapı sağlayıcıları kullanılır:
        </p>
        <List
          items={[
            ["MongoDB Atlas", "Veritabanı barındırma."],
            ["Vercel", "Site barındırma ve sunucu."],
            ["Brevo", "E-posta gönderimi (doğrulama, bildirim)."],
            ["Google Gemini", "Sohbet asistanı ve ilan içerik denetimi. Asistana yazdığın mesaj işlenmek üzere gönderilir; hesap bilgilerin gönderilmez."],
          ]}
        />
      </Section>

      <Section title="Çerezler">
        <p>
          Yalnızca <strong>zorunlu</strong> çerez kullanılır: giriş yaptığında oturumunu
          taşıyan güvenlik çerezi (httpOnly). Reklam veya takip çerezi yoktur. Tarayıcı
          tarafında ayrıca karşılaştırma listesi ve sohbet geçmişi gibi tercihlerin
          cihazının yerel deposunda tutulur; bunlar sunucuya gönderilmez.
        </p>
      </Section>

      <Section title="Verilerin ne kadar saklanır?">
        <p>
          Hesabın açık olduğu sürece. Hesabını sildirirsen hesap bilgilerin ve ilanların
          silinir. Kabul edilen tekliflerdeki sohbetler 48 saat sonra kapanır.
        </p>
      </Section>

      <Section title="Haklarınız">
        <p>
          KVKK kapsamında; verilerine erişme, düzeltilmesini veya silinmesini isteme ve
          işlenmesine itiraz etme haklarına sahipsin. İlan ve profil bilgilerini zaten
          hesabından doğrudan düzenleyebilir ya da silebilirsin. Hesabını uygulama
          içinden tek adımda silme özelliği bulunmuyor. Hesap silme talebini kayıtlı
          e-posta adresinden OtoPiyasa bildirim e-postalarına yanıtlayarak iletebilirsin;
          talep elle incelenir ve ilişkili kayıtlar da bu incelemede değerlendirilir.
        </p>
      </Section>

      <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-500">
        Bu site bir üniversite bitirme projesidir ve ticari bir hizmet değildir.
        İlan verileri yalnızca karşılaştırma ve araştırma amacıyla derlenmektedir.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="text-sm leading-7 text-slate-300">{children}</div>
    </section>
  );
}

function List({ items }: { items: [string, string][] }) {
  return (
    <ul className="space-y-2">
      {items.map(([label, text]) => (
        <li key={label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <strong className="text-slate-200">{label}:</strong> {text}
        </li>
      ))}
    </ul>
  );
}
