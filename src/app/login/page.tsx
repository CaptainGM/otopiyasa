import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell
      title="Tekrar hoş geldin"
      subtitle="Favorilerin, arama geçmişin ve kişisel ayarların hesabına bağlı kalır."
    >
      {/* AuthForm useSearchParams (?next=) kullanır → Suspense sınırı gerekir */}
      <Suspense fallback={<p className="text-sm text-slate-400">Yükleniyor…</p>}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  );
}
