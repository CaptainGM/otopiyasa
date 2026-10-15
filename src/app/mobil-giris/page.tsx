import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";

// Uygulama kuruluysa bu bağlantı doğrudan uygulamayı açar; bu sayfa yalnızca tarayıcıda gösterilir.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Google ile giriş | OtoPiyasa",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MobileGoogleReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; hata?: string }>;
}) {
  const { code, hata } = await searchParams;

  if (code) {
    return (
      <AuthShell title="Giriş tamamlandı" subtitle="OtoPiyasa uygulamasına dönebilirsin.">
        <p className="text-sm text-slate-400">Uygulama giriş yapmanı otomatik tamamlayacak.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Google ile giriş tamamlanamadı"
      subtitle={hata ? "Uygulamaya dönüp tekrar deneyebilirsin." : "Bu sayfa Google ile girişin dönüş adresidir."}
    >
      <p className="text-sm text-slate-400">
        Uygulamadan başlattığın girişi tamamlamak için OtoPiyasa uygulamasını aç ve Google ile giriş yap düğmesine yeniden dokun.
      </p>
    </AuthShell>
  );
}
