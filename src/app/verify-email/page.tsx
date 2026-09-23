import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/VerifyEmailClient";

export const metadata = { title: "E-posta Doğrulama | OtoPiyasa" };
export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto max-w-md py-16">
      <Suspense fallback={<div className="card p-8 text-center text-slate-400">Yükleniyor…</div>}>
        <VerifyEmailClient />
      </Suspense>
    </div>
  );
}
