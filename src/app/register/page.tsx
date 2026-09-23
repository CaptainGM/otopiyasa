import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterPage() {
  return (
    <AuthShell
      title="OtoPiyasa hesabı oluştur"
      subtitle="Ücretsiz üye ol; favori ekle, ilan ver ve fiyat alarmları kur."
    >
      <Suspense fallback={<p className="text-sm text-slate-400">Yükleniyor…</p>}>
        <AuthForm mode="register" />
      </Suspense>
    </AuthShell>
  );
}
