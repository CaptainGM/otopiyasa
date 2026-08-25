"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fuelTypes, transmissions } from "@/lib/seed-data";
import {
  SELL_COLORS,
  BODY_TYPES,
  PROVINCES,
  districtsOf,
  formatNumberInput,
  parseNumberInput,
} from "@/lib/form-options";
const CURRENT_YEAR = new Date().getFullYear();

interface Props {
 
  initial?: Record<string, string | number | string[]>;
  listingId?: string;
 
  brands?: string[];
}

export function SellForm({ initial, listingId, brands = [] }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ status: string; reason?: string } | null>(null);
  
  const [images, setImages] = useState<string[]>(
    Array.isArray(initial?.images) ? (initial!.images as string[]) : []
  );
  const [imgLoading, setImgLoading] = useState(false);


  const init = (k: string) => (initial?.[k] !== undefined ? String(initial[k]) : "");
  const [price, setPrice] = useState(formatNumberInput(init("price")));
  const [mileage, setMileage] = useState(formatNumberInput(init("mileage")));
  const [minOffer, setMinOffer] = useState(formatNumberInput(init("minOffer")));
  const [province, setProvince] = useState(init("city"));
  const [district, setDistrict] = useState(init("district"));

  const priceValue = parseNumberInput(price);
  const minOfferValue = parseNumberInput(minOffer);

  const minOfferTooHigh = minOfferValue > 0 && priceValue > 0 && minOfferValue > priceValue;

  async function fileToDataUrl(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter((f) =>
      /image\/(png|jpe?g|webp)/.test(f.type)
    );
    if (files.length === 0) return;
    setImgLoading(true);
    try {
      const dataUrls = await Promise.all(files.slice(0, 12).map(fileToDataUrl));
      setImages((prev) => [...prev, ...dataUrls].slice(0, 12));
    } finally {
      setImgLoading(false);
      e.target.value = ""; 
    }
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (minOfferTooHigh) {
      setError("Kabul ettiğin en düşük teklif, ilan fiyatından yüksek olamaz.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      brand: fd.get("brand"),
      model: fd.get("model"),
      year: Number(fd.get("year")),
      price: priceValue,
      mileage: parseNumberInput(mileage),
      city: province,
      district,
      contactPhone: fd.get("contactPhone"),
      minOffer: minOfferValue,
      fuelType: fd.get("fuelType"),
      transmission: fd.get("transmission"),
      bodyType: fd.get("bodyType"),
      color: fd.get("color"),
      description: fd.get("description"),
      images,
    };

    try {
      const res = await fetch(listingId ? `/api/listings/${listingId}` : "/api/listings", {
        method: listingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "İlan gönderilemedi.");
        return;
      }
      setResult({ status: data.status, reason: data.reason });
      if (data.status === "approved") {
        setTimeout(() => {
          router.push("/profile");
          router.refresh();
        }, 1600);
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }

  const g = (k: string) => (initial?.[k] !== undefined ? String(initial[k]) : "");

  if (result?.status === "approved") {
    return (
      <div className="card space-y-2 p-8 text-center">
        <p className="text-4xl">✅</p>
        <p className="font-semibold text-emerald-300">İlanın yayınlandı!</p>
        <p className="text-sm text-slate-400">Profil sayfana yönlendiriliyorsun…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6">
      {result?.status === "rejected" && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          ⚠️ İlanın yayınlanamadı: {result.reason}
          <br />
          Bilgileri düzeltip tekrar gönderebilirsin. (Sana e-posta da gönderdik.)
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
       
        {brands.length > 0 ? (
          <Select label="Marka" name="brand" options={brands} defaultValue={g("brand")} />
        ) : (
          <Field label="Marka" name="brand" defaultValue={g("brand")} required />
        )}
        <Field label="Model" name="model" defaultValue={g("model")} required placeholder="Örn. Corolla" />
        <Field label="Yıl" name="year" type="number" min={1950} max={CURRENT_YEAR + 1} defaultValue={g("year")} required />

        
        <NumberField
          label="Fiyat (₺)"
          value={price}
          onChange={setPrice}
          placeholder="1.600.000"
          required
        />
        <NumberField
          label="Kilometre"
          value={mileage}
          onChange={setMileage}
          placeholder="125.000"
          required
        />

      
        <div>
          <label className="label" htmlFor="province">İl</label>
          <select
            id="province"
            className="select"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              setDistrict(""); 
            }}
            required
          >
            <option value="">Seçiniz</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="district">İlçe</label>
          <select
            id="district"
            className="select"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            disabled={!province}
          >
            <option value="">{province ? "Seçiniz" : "Önce il seç"}</option>
            {districtsOf(province).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <Select label="Yakıt" name="fuelType" options={fuelTypes} defaultValue={g("fuelType")} />
        <Select label="Vites" name="transmission" options={transmissions} defaultValue={g("transmission")} />
        <Select label="Kasa Tipi" name="bodyType" options={BODY_TYPES} defaultValue={g("bodyType")} />
        <Select label="Renk" name="color" options={SELL_COLORS} defaultValue={g("color")} />
      </div>

      <Field label="İletişim Telefonu" name="contactPhone" defaultValue={g("contactPhone")} required placeholder="05xx xxx xx xx" />

      
      <div>
        <NumberField
          label="Kabul ettiğin en düşük teklif (₺) — isteğe bağlı"
          value={minOffer}
          onChange={setMinOffer}
          placeholder="Boş bırakırsan sınırı biz belirleriz"
        />
        <p className="mt-1 text-xs text-slate-500">
          Bu tutarın altındaki teklifler sana hiç ulaşmaz. Alıcılar bu sınırı ilan sayfasında görür.
        </p>
        {minOfferTooHigh && (
          <p className="mt-1 text-xs text-red-400">
            En düşük teklif ({minOffer} ₺), ilan fiyatından ({price} ₺) yüksek olamaz.
          </p>
        )}
      </div>

      <div>
        <label className="label">Fotoğraflar (png/jpg — telefondan/bilgisayardan yükle)</label>
        <div className="flex flex-wrap gap-3">
          {images.map((src, i) => (
            <div key={i} className="relative h-20 w-28 overflow-hidden rounded-lg border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label="Fotoğrafı kaldır"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < 12 && (
            <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 text-xs text-slate-400 transition hover:border-amber-400/40 hover:text-amber-300">
              <span className="text-lg leading-none">＋</span>
              {imgLoading ? "Yükleniyor…" : "Fotoğraf ekle"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFiles}
                className="hidden"
              />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          En fazla 12 fotoğraf. Fotoğraflar cihazında küçültülüp güvenle yüklenir.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="description">Açıklama</label>
        <textarea
          id="description"
          name="description"
          defaultValue={g("description")}
          className="input min-h-[120px]"
          placeholder="Aracın durumu, bakımları, ekstra donanımlar…"
        />
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? "Denetleniyor…" : listingId ? "İlanı Güncelle" : "İlanı Yayınla"}
      </button>
    </form>
  );
}

function Field({
  label, name, type = "text", defaultValue, required, min, max, placeholder,
}: {
  label: string; name: string; type?: string; defaultValue?: string;
  required?: boolean; min?: number; max?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name} name={name} type={type} defaultValue={defaultValue}
        required={required} min={min} max={max} placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

function Select({
  label, name, options, defaultValue,
}: {
  label: string; name: string; options: string[]; defaultValue?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue} className="select">
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}


function NumberField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatNumberInput(e.target.value))}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
