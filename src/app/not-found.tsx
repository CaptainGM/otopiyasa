import Link from "next/link";

export const metadata = { title: "Sayfa bulunamadı | OtoPiyasa" };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <span className="stat-tile-icon h-16 w-16 rounded-2xl text-2xl">404</span>
      <h1 className="text-2xl font-black tracking-tight">Bu sayfa bulunamadı</h1>
      <p className="text-slate-400">
        Aradığın ilan ya da sayfa kaldırılmış olabilir, ya da adres yanlış yazılmış olabilir.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Anasayfaya dön
        </Link>
        <Link href="/map" className="btn btn-secondary">
          Haritada gez
        </Link>
      </div>
    </div>
  );
}
