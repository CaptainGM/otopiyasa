import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Gezinti bağlantısı: ön yükleme kapalı. Varsayılan ön yükleme, sayfa açılışında her menü bağlantısı için ayrı bir sunucu
 * isteği (≈15) atıyor ve Vercel'de yeni sunucu örneklerini tetikliyordu; ilan sayfası bu kalabalıkta saniyelerce bekliyordu.
 */
export function NavLink(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}
