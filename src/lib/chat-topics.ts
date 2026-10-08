import type { ChatLink } from "@/lib/chatbot";

/**
 * Asistan bir site özelliğini anlattığında ("nasıl ilan veririm", "favorilerim nerede") kullanıcı tek dokunuşla o sayfaya
 * gidebilsin diye mesajdaki konuya göre yönlendirme düğmesi üretir. Adresler web yoludur; mobil uygulama aynı yolları kendi
 * ekranlarına çevirir (bkz. mobile/lib/screens/assistant_screen.dart).
 * Sıra önemli: ilk eşleşen konu kazanır.
 */
const TOPICS: Array<{ test: RegExp; link: ChatLink }> = [
  { test: /ilan\S*\s+(?:\S+\s+){0,2}(düzenle|sil|kaldır)|ilanlarım/, link: { href: "/listings", label: "İlanlarım →" } },
  { test: /ilan\s*(ver|yayınla|ekle|aç)|ilan\s*vereceğ|aracımı\s*sat|satışa\s*çıkar/, link: { href: "/sell", label: "İlan ver →" } },
  { test: /teklif/, link: { href: "/offers", label: "Tekliflerim →" } },
  { test: /favori/, link: { href: "/favorites", label: "Favorilerim →" } },
  { test: /karşılaştır/, link: { href: "/compare", label: "Karşılaştırmaya git →" } },
  { test: /değer\s*kayb|amortisman|yılda\s*ne\s*kadar\s*(düş|değer)/, link: { href: "/deger-kaybi", label: "Değer kaybına git →" } },
  { test: /fiyat\s*tahmin|tahmin\s*et|tahmin/, link: { href: "/predict", label: "Fiyat tahminine git →" } },
  { test: /harita|yakınımda|yakınımdaki/, link: { href: "/map", label: "Haritayı aç →" } },
  { test: /abone|alarm/, link: { href: "/subscriptions", label: "Aboneliklerim →" } },
  { test: /analiz|istatistik|piyasa\s*durumu/, link: { href: "/analytics", label: "Analize git →" } },
  { test: /şifre|giriş|kayıt\s*ol|doğrulama|e-?posta\s*gelm/, link: { href: "/login", label: "Giriş yap →" } },
  { test: /profil|hesabım|hesap\s*ayar/, link: { href: "/profile", label: "Hesabım →" } },
];

/** Kullanıcının mesajı bir site özelliğinden söz ediyorsa ilgili sayfaya yönlendirme; yoksa null. */
export function topicLinkFor(userMessage: string): ChatLink | null {
  const message = userMessage.toLocaleLowerCase("tr-TR");
  for (const topic of TOPICS) {
    if (topic.test.test(message)) return topic.link;
  }
  return null;
}
