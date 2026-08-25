import Link from "next/link";
import { Logo } from "@/components/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-120px)] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden lg:block">
        <Logo />
        <div className="mt-10 space-y-6">
          <h1 className="max-w-lg text-4xl font-black leading-tight">
            {title}
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-slate-400">
            {subtitle}
          </p>
          <div className="grid max-w-md gap-3">
            <div className="stat-tile">Sahibinden ve Arabam ilanlarını tek yerde topla</div>
            <div className="stat-tile">Her araç için marka/model/yıl piyasa ortalaması</div>
            <div className="stat-tile">Favoriler, analiz ve mobil uygulama desteği</div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-md space-y-4">
        <div className="lg:hidden">
          <Link href="/">
            <Logo compact />
          </Link>
        </div>
        <div className="card p-6">{children}</div>
        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="text-amber-300 hover:underline">
            Ana sayfaya dön
          </Link>
        </p>
      </section>
    </div>
  );
}
