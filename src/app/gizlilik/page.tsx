import Link from "next/link";

export const metadata = {
  title: "Gizlilik Politikası | OtoPiyasa",
  description:
    "OtoPiyasa hangi verileri topluyor, neden topluyor, nerede saklıyor, ilan kalitesi puanı nasıl hesaplanıyor ve kullanıcı hakları nelerdir.",
};

/**
 * GİZLİLİK POLİTİKASI.
 *
 * Neden gerekli: (1) kayıt/e-posta/telefon gibi kişisel veri işleniyor, KVKK kapsamında aydınlatma yükümlülüğü var;
 * (2) mobil uygulama Google Play'e yüklenecekse herkese açık bir gizlilik politikası ADRESİ zorunlu.
 *
 * Metin sade ve gerçek uygulamaya dayalı: her madde koddaki bir özellikle eşleşir (oturum kaydı, bildirim belirteci, Gemini
 * kullanımları, kaynak siteleri, cihaz deposu). Olmayan bir şeyi vaat etmez (reklam ağı, veri satışı, analitik takibi yok).
 */
export default function PrivacyPage() {
  const updated = "14 Ekim 2026";

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
          OtoPiyasa, akademik amaçlı geliştirilmiş bir üniversite bitirme projesidir. Verilerini satmıyoruz, reklam ağlarıyla
          paylaşmıyoruz, takip çerezi kullanmıyoruz ve hesabını istediğin zaman sildirebilirsin. Aşağıda hangi veriyi neden
          tuttuğumuzu tek tek yazdık.
        </p>
      </Section>

      <Section title="Hangi verileri topluyoruz?">
        <List
          items={[
            [
              "Hesap bilgileri",
              "Ad soyad, e-posta adresi ve şifren. Şifre asla düz metin olarak saklanmaz; geri döndürülemez şekilde (bcrypt) şifrelenir. İsteğe bağlı olarak profil fotoğrafı ve işletme adı ekleyebilirsin.",
            ],
            [
              "İlan bilgileri",
              "İlan verirsen: araç bilgileri, fotoğraflar, açıklama, hasar/boya bilgisi, konum (il/ilçe) ve iletişim telefonun.",
            ],
            [
              "Etkileşimler",
              "Favorilerin, verdiğin/aldığın teklifler, teklif sohbetleri, sorduğun sorular, kayıtlı aramaların ve fiyat uyarıların.",
            ],
            [
              "Talep ve şikayet formu",
              "Formu gönderirsen: talep türü, konu, mesaj, e-posta adresin (giriş yapmadıysan zorunlu), istersen adın ve ilgili ilan. Ayrıntılar: Talep ve şikayet bölümü.",
            ],
            [
              "Oturum ve cihaz kaydı",
              "Giriş yaptığında her oturum için IP adresi, tarayıcı ya da uygulama bilgisi (user agent), bu bilgiden üretilen cihaz adı (ör. \"Chrome · Windows\") ve son görülme zamanı tutulur. Cihazlar bölümünden bu oturumları görüp sonlandırabilirsin.",
            ],
            [
              "Konum (isteğe bağlı)",
              "Yakınımdakiler özelliğini kullanırsan yaklaşık konumun (enlem/boylam) yakındaki ilanları hesaplamak için sunucuya gönderilir. Bu uç nokta koordinatı uygulama veritabanına kaydetmez; istek web sunucusu ve altyapı günlüklerinde yer alabilir.",
            ],
            [
              "Bildirim izni (isteğe bağlı)",
              "Tarayıcı bildirimi açarsan tarayıcının ürettiği abonelik anahtarı. Mobil uygulamada bildirim için Google Firebase Cloud Messaging'in cihaz belirteci (token) kaydedilir.",
            ],
          ]}
        />
      </Section>

      <Section title="Telefon numaran ve adın nasıl korunuyor?">
        <p>
          Herkese açık ilan detayında telefon numaran yer almaz. İlan sahibi kendi numarasını yönetim ekranında görebilir; alıcıya
          ise teklif kabul edildiğinde teklif sohbetinde gösterilir. Adın soru/yorum alanlarında maskelenir.
        </p>
      </Section>

      <Section title="Verileri neden işliyoruz?">
        <List
          items={[
            ["Hizmeti sunmak", "Giriş yapman, ilan vermen, teklif alıp vermen için."],
            [
              "Güvenlik",
              "Sahte hesapları, spam ilanları ve kötüye kullanımı engellemek için (hız sınırı, e-posta doğrulama, içerik denetimi); oturum listesi ile hesabına yetkisiz erişimi fark edebilmek için.",
            ],
            ["Bilgilendirme", "Şifre sıfırlama, e-posta doğrulama, teklif/soru bildirimleri, kayıtlı aramalara uyan yeni ilanlar ve favori aracında fiyat düşüşü uyarıları."],
          ]}
        />
      </Section>

      <Section title="İlan verileri nereden geliyor?">
        <p>
          Sitedeki ilanların büyük kısmı halka açık kaynaklardan karşılaştırma ve araştırma amacıyla derlenmiştir: Arabam.com,
          Otokoç, DOD, Otomerkezi, Vavacars, Otoplus, Carvak ve İkinci Yeni (ihale sitesi). Bu ilanların sahipleri OtoPiyasa üyesi
          değildir ve bu ilanlara teklif verilemez, soru sorulamaz. Üyelerin kendi verdiği ilanlar ayrıca işaretlidir.
        </p>
      </Section>

      <Section id="ilan-kalitesi" title="İlan kalitesi puanı nasıl hesaplanır?">
        <p>
          Yayındaki her ilanın detay sayfasında 0–100 arası bir <strong>bilgi tamlığı</strong> puanı gösterilir. Puan yalnızca
          ilanın kendi alanlarına bakar: kişisel veri kullanmaz, aracın durumunu, fiyatın doğruluğunu ya da satıcının
          güvenilirliğini değerlendirmez. Kriterler ve puanlar:
        </p>
        <List
          items={[
            ["Fotoğraf (en fazla 25)", "10 ve üzeri fotoğraf 25; 6–9 fotoğraf 17; 3–5 fotoğraf 9; 1–2 fotoğraf 3 puan."],
            [
              "Açıklama (en fazla 30)",
              "Uzunluk: 300 karakter ve üzeri 12; 150–299 karakter 7; 40–149 karakter 3 puan. Ayrıca açıklamada geçen her bilgi konusu 3 puan (en fazla 6 konu, 18 puan): bakım geçmişi, parça ve boya durumu, donanım, kullanım geçmişi (tek sahip, garaj, kaza yok vb.), belge ve muayene, lastik-fren ve yedek parça. Konular anahtar kelime eşleşmesiyle bulunur; bu hesap için hiçbir dış servise veri gönderilmez.",
            ],
            [
              "Hasar / boya bilgisi (15)",
              "İlanda boya-değişen bilgisi, parça listesi ya da hasar kaydı varsa 15 puan. \"Belirtilmemiş\" ya da boş alan bilgi sayılmaz.",
            ],
            [
              "Temel özellikler (30)",
              "Yakıt, vites, kasa tipi, renk ve motor hacmi her biri 6 puan. \"Bilinmiyor\", \"Belirtilmemiş\" ya da \"Doğrulanıyor\" olan alan sayılmaz. Motosiklet ve karavanda kasa tipi ölçülmez; puan kalan ölçütlere göre orantılanır.",
            ],
          ]}
        />
        <p>
          Kaynak sitede ilanın ne zaman kontrol edildiği puana dahil değildir; bu, taramamızın sıklığına bağlıdır, ilanın
          kendisine değil. Yayından kalkmış (arşivdeki) ilanlarda puan gösterilmez. Kaynak verisi tam çekilemeyen Otomerkezi ilanlarında da şimdilik puan gösterilmez. Puan yalnızca bilgi tamlığını ölçer; ilanın
          doğruluğunu ya da aracın kalitesini garanti etmez. Kriterler değişirse bu bölüm güncellenir.
        </p>
      </Section>

      <Section title="Verilerini kimlerle paylaşıyoruz?">
        <p className="mb-2">
          Verilerini <strong>satmıyoruz</strong> ve reklam amacıyla paylaşmıyoruz. Hizmetin çalışması için yalnızca şu sağlayıcıları
          kullanırız:
        </p>
        <List
          items={[
            ["MongoDB Atlas", "Veritabanı barındırma."],
            ["Vercel", "Site barındırma ve sunucu."],
            ["E-posta sağlayıcısı (SMTP)", "Doğrulama ve bildirim e-postaları."],
            ["Google Firebase Cloud Messaging", "Mobil uygulama bildirimleri (cihaz belirteci)."],
            [
              "Google Gemini",
              "Sohbet asistanı; ilan içeriği denetimi; profil fotoğrafı denetimi; yüklediğin ilan fotoğraflarının fiyat tahmini için analizi. Bu işlemlerde yazdığın metin ya da yüklediğin fotoğraf Google'a iletilir; hesap bilgilerin gönderilmez.",
            ],
          ]}
        />
      </Section>

      <Section title="Çerezler ve cihazındaki veriler">
        <p>
          Yalnızca <strong>zorunlu</strong> çerez kullanılır: giriş yaptığında oturumunu taşıyan güvenlik çerezi (httpOnly). Reklam
          veya takip çerezi yoktur. Cihazında ayrıca şunlar tutulur ve sunucuya gönderilmez: karşılaştırma listesi, son baktıkların
          (her hesap için ayrı) ve asistan sohbet geçmişi. Mobil uygulamada oturum belirteci telefonun şifreli depolama alanında
          saklanır.
        </p>
      </Section>

      <Section title="Verilerin ne kadar saklanır?">
        <p>
          Hesabın açık olduğu sürece hesap bilgilerin ve ilanların saklanır. Hesabını sildirirsen hesap bilgilerin ve ilanların
          silinir. Kabul edilen tekliflerdeki sohbetler 48 saat sonra kapanır. Oturum kayıtları hesabın açık olduğu sürece
          tutulur; bir oturumu sonlandırmak kaydı silmez, yalnızca iptal eder. Yayından kalkan derlenmiş ilanlar fiyat analizi için arşivde saklanır. Hız sınırı için tutulan IP bilgisi ham
          adres değil, özetidir (karma) ve yalnızca sınırlama için kullanılır. Talep kayıtları "Talep ve şikayet" bölümünde yazılı
          şekilde saklanır.
        </p>
      </Section>

      <Section id="talep" title="Talep ve şikayet">
        <p>
          Talep oluştur formuyla şikayet, hata bildirimi, öneri veya kişisel veri talebi (KVKK) gönderebilirsin. Aşağıda neyin
          saklandığını, kimlerin gördüğünü ve ne kadar tutulduğunu yazdık.
        </p>
        <List
          items={[
            [
              "Ne saklanır",
              "Talep türü, konu, mesaj, e-posta adresin (giriş yapmadıysan zorunlu), istersen adın ve ilgili ilan. Giriş yapmışsan talep hesabına bağlanır. IP adresi talep kaydına yazılmaz; sıklık sınırı için yalnızca IP'nin karma özeti kısa süre kullanılır.",
            ],
            [
              "Kimler görür",
              "Yalnızca site yöneticileri. Yöneticiler talebin durumunu değiştirebilir ve dahili not ekleyebilir; bu notlar sana gösterilmez.",
            ],
            [
              "Yanıt",
              "Yanıt gerekirse bildirdiğin e-posta adresi üzerinden verilir. Talep gönderildiğinde yöneticilere site içi bildirim gider.",
            ],
            [
              "Ne kadar saklanır",
              "Talep çözülse ya da reddedilse de inceleme ve kayıt amacıyla saklanır. Silinmesini istersen \"Kişisel veri talebi (KVKK)\" türüyle bildir; talep elle incelenip silinir.",
            ],
            ["Kişisel veri hakların", "Erişim, düzeltme, silme ve itiraz talepleri bu formdan da iletilebilir."],
          ]}
        />
      </Section>

      <Section title="Haklarınız">
        <p>
          KVKK kapsamında; verilerine erişme, düzeltilmesini veya silinmesini isteme ve işlenmesine itiraz etme haklarına
          sahipsin. İlan ve profil bilgilerini zaten hesabından doğrudan düzenleyebilir ya da silebilirsin. Oturumlarını Cihazlar
          bölümünden sonlandırabilirsin. Hesabını uygulama içinden tek adımda silme özelliği bulunmuyor. Hesap silme talebini
          kayıtlı e-posta adresinden OtoPiyasa bildirim e-postalarına yanıtlayarak iletebilirsin; talep elle incelenir ve ilişkili
          kayıtlar da bu incelemede değerlendirilir.
        </p>
      </Section>

      <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-500">
        Bu site bir üniversite bitirme projesidir ve ticari bir hizmet değildir. İlan verileri yalnızca karşılaştırma ve araştırma
        amacıyla derlenmektedir.
      </p>
    </div>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-2">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-slate-300">{children}</div>
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
