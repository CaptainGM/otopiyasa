import { PricePredictorForm } from "@/components/PricePredictorForm";

export default function PredictPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fiyat Tahmini</h1>
        <p className="text-slate-500">
          Marka, model, yıl ve kilometre gir; veritabanındaki ilanlar üzerinden
          eğitilen basit bir lineer regresyon modeli piyasa fiyatını tahmin etsin.
        </p>
      </div>
      <PricePredictorForm />
    </div>
  );
}
