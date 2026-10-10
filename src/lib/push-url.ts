/**
 * Bildirim yükündeki adresi mutlak hâle getirir.
 *
 * Çağıranlar çoğunlukla göreli yol veriyor (`/cars/<id>`); tarayıcı bildirimi bunu kendi
 * kaynağına göre açabildiği için sorun olmuyordu, ama mobil uygulama bağlantıyı ayrıştırırken
 * (bkz. mobile/lib/utils/deep_link.dart) tam adres bekliyor — göreli yolda ilan açılmıyordu.
 */
export function absolutePushUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://otopiyasa.app").replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}
