/**
 * İstek gövdesini güvenle okur. Bozuk JSON ya da nesne olmayan gövde istisna fırlatıp 500 döndürmesin diye boş
 * nesne verilir; alan doğrulamaları zaten 400 üretir.
 *
 * `flat: true` (giriş, kayıt, şifre sıfırlama gibi yalnızca metin alanı olan uç noktalar): iç içe nesne/dizi
 * değerleri boş metne çevrilir, sayılar metne dönüşür. Böylece `{"email": {"$ne": null}}` gibi veritabanı işleci
 * denemeleri ya da `email.toLowerCase()` çökmeleri (500) oluşmaz.
 */
export async function readJson(request: Request, options: { flat?: boolean } = {}): Promise<Record<string, any>> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  if (!options.flat) return data as Record<string, any>;

  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value === null || value === undefined) out[key] = "";
    else if (typeof value === "object") out[key] = "";
    else if (typeof value === "number") out[key] = String(value);
    else out[key] = value;
  }
  return out;
}
