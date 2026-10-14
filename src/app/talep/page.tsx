import Link from "next/link";
import { RequestForm } from "@/components/RequestForm";

export const metadata = {
  title: "Talep ve şikayet | OtoPiyasa",
  description: "Şikayet, hata bildirimi, öneri veya kişisel veri talebi (KVKK) gönderin.",
};

export default function RequestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <Link href="/" className="text-sm text-amber-300 hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Talep ve şikayet</h1>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          Şikayet, hata bildirimi, öneri veya kişisel veri talebi (KVKK) için bu formu kullan. Mesajın yalnızca site yöneticilerine
          görünür. Hangi verilerin nasıl tutulduğu için{" "}
          <Link href="/gizlilik#talep" className="text-amber-300 hover:underline">
            gizlilik politikasına
          </Link>{" "}
          bak.
        </p>
      </div>
      <RequestForm />
    </div>
  );
}
