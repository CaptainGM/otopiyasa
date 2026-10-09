"use client";

import { useRef, useState } from "react";
import { AVATAR_PRESET_COUNT, AVATAR_SEED_COUNT, AVATAR_STYLES, presetId, presetImagePath, type AvatarDescriptor, type AvatarStyleId } from "@/lib/avatar";

/** Tarayıcıda 320 px kareye kırpıp küçültür: sunucuya megabaytlık fotoğraf gitmesin (sunucu yine 256 px'e yeniden kodlar). */
async function resizeToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tarayıcın görüntü işlemeyi desteklemiyor.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 320, 320);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

const GRID_SIZE = 12;
const randomSeeds = () => Array.from({ length: GRID_SIZE }, () => Math.floor(Math.random() * AVATAR_SEED_COUNT));

/** Profil resmi seçici: çizim avatarlar (stil sekmeleri + "Karıştır") ya da kendi fotoğrafın. Küçük bir pencerede açılır. */
export function AvatarPicker({ avatar, onDone }: { avatar: AvatarDescriptor; onDone?: () => void }) {
  const [style, setStyle] = useState<AvatarStyleId>("lorelei");
  const [seeds, setSeeds] = useState<number[]>(randomSeeds);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function call(request: () => Promise<Response>, okMessage: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await request();
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "İşlem başarısız.");
      setMessage(okMessage);
      // Menüdeki rozet de güncellensin diye sayfa yenilenir.
      setTimeout(() => {
        onDone?.();
        window.location.reload();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!selected) return;
    return call(
      () => fetch("/api/auth/avatar", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: selected }) }),
      "Profil resmin güncellendi."
    );
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Yalnızca JPEG, PNG ya da WebP fotoğraf yükleyebilirsin.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Fotoğraf çok büyük (en fazla 12 MB).");
      return;
    }
    let image: string;
    try {
      image = await resizeToDataUrl(file);
    } catch {
      setError("Fotoğraf açılamadı, başka bir dosya dene.");
      return;
    }
    await call(
      () => fetch("/api/auth/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) }),
      "Fotoğrafın denetimden geçti ve kaydedildi."
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Avatar stili">
        {AVATAR_STYLES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={style === item.id}
            onClick={() => {
              setStyle(item.id);
              setSeeds(randomSeeds());
              setSelected(null);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              style === item.id ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSeeds(randomSeeds());
            setSelected(null);
          }}
          className="ml-auto rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/5"
        >
          Karıştır
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6" role="radiogroup" aria-label="Avatarlar">
        {seeds.map((seed) => {
          const id = presetId(style, seed);
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected === id}
              onClick={() => setSelected(id)}
              className={`overflow-hidden rounded-2xl border-2 transition ${selected === id ? "border-amber-300" : "border-transparent hover:border-white/25"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={presetImagePath(style, seed)} alt="" width={96} height={96} loading="lazy" className="aspect-square h-auto w-full object-cover" />
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">{AVATAR_PRESET_COUNT.toLocaleString("tr-TR")} hazır avatardan biri; beğenmediysen &quot;Karıştır&quot;.</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy || !selected} className="btn btn-primary text-sm">
          {busy ? "Kaydediliyor..." : "Bunu kullan"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-secondary text-sm">
          Kendi fotoğrafımı yükle
        </button>
        {avatar && (
          <button type="button" onClick={() => call(() => fetch("/api/auth/avatar", { method: "DELETE" }), "Profil resmi kaldırıldı.")} disabled={busy} className="btn btn-secondary text-sm">
            Kaldır
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
      </div>
      <p className="text-[11px] leading-snug text-slate-500">Müstehcen, şiddet içeren, terör/nefret sembolü ya da siyasi içerikli fotoğraflar otomatik denetlenir ve kabul edilmez.</p>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}
    </div>
  );
}
