"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

interface Props {
  isLoggedIn: boolean;
  isAdmin: boolean;
  name?: string;
}

const PUBLIC_LINKS = [
  { href: "/", label: "Keşfet" },
  { href: "/analytics", label: "Analiz" },
  { href: "/predict", label: "Fiyat Tahmini" },
  { href: "/compare", label: "Karşılaştır" },
  { href: "/map", label: "Harita" },
];

const MEMBER_LINKS = [
  { href: "/favorites", label: "Favoriler" },
  { href: "/offers", label: "Tekliflerim" },
  { href: "/listings", label: "İlanlarım" },
  { href: "/sell", label: "İlan Ver" },
];


export function MobileMenu({ isLoggedIn, isAdmin, name }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = () => setOpen(false);
  const linkCls = (href: string) =>
    `block rounded-lg px-3 py-2.5 text-base font-medium transition ${
      pathname === href ? "bg-amber-400/15 text-amber-300" : "text-slate-200 hover:bg-white/5"
    }`;

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menü"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-200 transition hover:bg-white/5"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <>
          
          <div className="fixed inset-0 top-[var(--nav-h,64px)] z-40 bg-black/40" onClick={close} />
          <nav className="absolute right-0 top-12 z-50 w-64 max-w-[85vw] overflow-hidden rounded-2xl border border-white/10 bg-[var(--menu-bg)] p-2 shadow-2xl backdrop-blur-xl">
            {PUBLIC_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={close} className={linkCls(l.href)}>
                {l.label}
              </Link>
            ))}

            <div className="my-1 h-px bg-white/10" />

            {isLoggedIn ? (
              <>
                {MEMBER_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} onClick={close} className={linkCls(l.href)}>
                    {l.label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link href="/admin" onClick={close} className={linkCls("/admin")}>
                    Yönetim
                  </Link>
                )}
                <Link href="/profile" onClick={close} className={linkCls("/profile")}>
                  {name || "Profilim"}
                </Link>
                <div className="px-1 pt-1" onClick={close}>
                  <LogoutButton />
                </div>
              </>
            ) : (
              <>
                <Link href="/login" onClick={close} className={linkCls("/login")}>
                  Giriş
                </Link>
                <Link
                  href="/register"
                  onClick={close}
                  className="mt-1 block rounded-lg bg-amber-400 px-3 py-2.5 text-center text-base font-bold text-[#221202]"
                >
                  Kayıt Ol
                </Link>
              </>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
