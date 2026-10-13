"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { Icon, type IconName } from "@/components/Icon";
import { useViewer } from "@/components/useViewer";

/**
 * Telefonda alt hızlı geçiş çubuğu (mobil uygulamadaki alt menünün aynısı: Keşfet, Favoriler, Değer Kaybı, Karşılaştır, Tahmin, Analiz,
 * Hesap). Kullanıcı sağ üstteki menüyü açmadan ana sayfalara tek dokunuşla geçer; geniş ekranda gizlidir (üst menü yeter).
 */
const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Keşfet", icon: "grid" },
  { href: "/favorites", label: "Favoriler", icon: "heart" },
  { href: "/deger-kaybi", label: "Değer Kaybı", icon: "trendDown" },
  { href: "/compare", label: "Karşılaştır", icon: "compare" },
  { href: "/predict", label: "Tahmin", icon: "tag" },
  { href: "/analytics", label: "Analiz", icon: "pulse" },
];

export function MobileBottomNav() {
  const pathname = usePathname() || "/";
  const { viewer } = useViewer();
  const tabs = [...TABS, { href: viewer ? "/profile" : "/login", label: "Hesap", icon: "user" as IconName }];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav
      aria-label="Hızlı geçiş"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--nav-bg)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-xl">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <li key={tab.label} className="min-w-0 flex-1">
              <NavLink
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-0 py-2 text-[9.5px] font-medium leading-tight tracking-tight transition ${
                  active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <Icon name={tab.icon} size={21} strokeWidth={active ? 2 : 1.6} />
                <span className="w-full break-words text-center">{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
