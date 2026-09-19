import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { MobileMenu } from "@/components/MobileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--nav-bg)] backdrop-blur-xl">
      <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
        <Link href="/" className="shrink-0">
         
          <span className="hidden md:block"><Logo /></span>
          <span className="md:hidden"><Logo compact /></span>
        </Link>

        
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          {user && <NotificationBell />}
          <MobileMenu isLoggedIn={!!user} isAdmin={user?.role === "admin"} name={user?.name} />
        </div>

        
        <form action="/" method="get" className="order-last w-full md:order-none md:w-64 lg:w-80">
          <div className="relative">
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              aria-hidden
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="m20 20-3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              name="q"
              type="search"
              placeholder="Marka, model, şehir ara…"
              aria-label="Araç ara"
              className="input input-search w-full text-sm"
            />
          </div>
        </form>

        
        <nav className="hidden flex-wrap items-center gap-1 text-sm md:flex">
          <Link href="/" className="nav-link">
            Keşfet
          </Link>
          <Link href="/analytics" className="nav-link">
            Analiz
          </Link>
          <Link href="/predict" className="nav-link">
            Fiyat Tahmini
          </Link>
          <Link href="/compare" className="nav-link">
            Karşılaştır
          </Link>
          <Link href="/map" className="nav-link">
            Harita
          </Link>
          
          {user && (
            <>
              <Link href="/favorites" className="nav-link">
                Favoriler
              </Link>
              <Link href="/offers" className="nav-link">
                Tekliflerim
              </Link>
              <Link href="/listings" className="nav-link">
                İlanlarım
              </Link>
              <Link href="/sell" className="nav-link text-amber-300/90">
                İlan Ver
              </Link>
            </>
          )}

          <ThemeToggle className="mx-1" />
          <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />

          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className="nav-link text-amber-300/90">
                  Yönetim
                </Link>
              )}
              <NotificationBell />
              <Link href="/profile" className="user-pill transition hover:brightness-110" title="Profilim">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                {user.name}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link">
                Giriş
              </Link>
              <Link href="/register" className="btn btn-primary px-4 py-2 text-sm">
                Kayıt Ol
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
