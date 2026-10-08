import type { Metadata } from "next";
import { DegerKaybi } from "@/components/DegerKaybi";

export const metadata: Metadata = {
  title: "Değer kaybı | OtoPiyasa",
  description: "Marka ve modelin yaşa, kilometreye ve hasar durumuna göre değer kaybı: aynı yaş ve kilometrede hasarın ve boyanın fiyata etkisi.",
};

// Sayfanın kendisi sabit; veriler istemciden, CDN'de önbellekli API'den (/api/analytics/model-breakdown) gelir.
export default function DegerKaybiPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Fiyat istihbaratı</p>
        <h1 className="font-display text-3xl font-bold">Değer kaybı</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-[var(--muted)]">
          Bir modelin fiyatı yaşla, kilometreyle ve hasar durumuyla nasıl düşüyor? Her etki diğerlerinden ayrıştırılarak
          hesaplanır: "aynı yaş ve kilometrede hasar kayıtlı araç yüzde kaç daha ucuz" gibi sorulara cevap verir.
        </p>
      </div>
      <DegerKaybi />
    </div>
  );
}
