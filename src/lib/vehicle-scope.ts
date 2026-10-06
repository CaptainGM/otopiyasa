import { modelFamily } from "@/lib/model-family";

/**
 * PLATFORM KAPSAMI: OtoPiyasa otomobil, SUV ve hafif ticari "araba" (Doblo, Berlingo, Caddy, Partner gibi
 * minivan/panelvan) ilanları içindir. Kamyon, tır, otobüs, minibüs, kamyonet (şasi kabin), pickup, motosiklet,
 * ATV ve karavan kapsam dışıdır (kullanıcı kararı, 2026-10-06). Tüm kaynaklar kayıttan önce bu kurala bakar;
 * kapsam dışı ilan eklenmez, mevcutsa arşive alınır.
 */

const fold = (value?: string | null) =>
  (value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();

/** Yalnızca motosiklet/scooter/ATV üreten markalar (otomobil üretmeyen). */
const MOTO_BRANDS = new Set(
  [
    "yamaha", "bajaj", "kymco", "tvs", "mondial", "rks", "arora", "yuki", "kuba", "apec", "kawasaki", "ducati",
    "harley-davidson", "harley davidson", "ktm", "piaggio", "vespa", "cfmoto", "cf moto", "benelli", "triumph",
    "royal enfield", "sym", "hero", "kanuni", "falcon", "motolux", "husqvarna", "aprilia", "mv agusta", "zontes",
    "voge", "segway", "polaris", "can-am", "can am", "linhai", "hisun", "beta", "gasgas", "keeway", "lifan moto",
  ].map(fold)
);

/** Kamyon, otobüs ve ağır ticari üreticileri (binek/hafif ticari satmayan). */
const HEAVY_BRANDS = new Set(
  [
    "ford trucks", "bmc", "man", "scania", "daf", "iveco", "iveco-otoyol", "otoyol", "otokar", "temsa", "hino",
    "renault trucks", "volvo trucks", "fuso", "mitsubishi fuso", "isuzu-anadolu", "guleryuz", "güleryüz",
  ].map(fold)
);

/** Marka + model ailesi bazında kapsam dışı modeller. */
const OUT_OF_SCOPE_MODELS: Array<{ brand: RegExp; model: RegExp; reason: string }> = [
  // Pickup'lar
  { brand: /toyota/, model: /^(hilux|tacoma|tundra)/, reason: "pickup" },
  { brand: /ford/, model: /^(ranger|f-?\s?150|f-?\s?250|maverick)/, reason: "pickup" },
  { brand: /nissan/, model: /^(navara|np\s?300|king cab|pick)/, reason: "pickup" },
  // "L 300" panelvan aynı "L Serisi" ailesinde; yalnızca L 200 pickup'tır.
  { brand: /mitsubishi/, model: /^(l\s?200|strakar|triton)/, reason: "pickup" },
  { brand: /^isuzu/, model: /^(d-?\s?max|tf\b|kb\b|npr|nqr|nkr|npk|nlr|nnr|novo|turquoise|citiport|grafter|m-?max|n-?wide|anadolu)/, reason: "pickup / kamyonet" },
  { brand: /volkswagen/, model: /^amarok/, reason: "pickup" },
  { brand: /fiat/, model: /^(fullback|strada|toro)/, reason: "pickup" },
  { brand: /mazda/, model: /^(bt-?\s?50|b\s?serisi|b\s?2500)/, reason: "pickup" },
  { brand: /mercedes/, model: /^(x[\s-]?(\d{3}|serisi|sinifi|class)|x$)/, reason: "pickup" },
  { brand: /ssangyong|kg mobility/, model: /^(actyon sports|korando sports|musso|rexton sports)/, reason: "pickup" },
  { brand: /great wall|gwm/, model: /^(poer|steed|wingle)/, reason: "pickup" },
  { brand: /renault/, model: /^alaskan/, reason: "pickup" },
  { brand: /peugeot/, model: /^landtrek/, reason: "pickup" },
  { brand: /chevrolet/, model: /^(colorado|silverado)/, reason: "pickup" },
  { brand: /dodge|ram/, model: /^(ram|dakota)/, reason: "pickup" },
  { brand: /jeep/, model: /^gladiator/, reason: "pickup" },
  { brand: /tata/, model: /^(xenon|telcoline)/, reason: "pickup" },
  { brand: /mahindra/, model: /^(pik-?up|scorpio pik)/, reason: "pickup" },
  { brand: /jac/, model: /^t[68]/, reason: "pickup" },
  { brand: /tesla/, model: /^cybertruck/, reason: "pickup" },
  // Kamyon / otobüs / kamyonet
  { brand: /mercedes/, model: /^(actros|axor|atego|arocs|antos|unimog|econic|travego|tourismo|intouro|conecto|citaro|o\s?\d{3})/, reason: "kamyon / otobüs" },
  { brand: /mitsubishi/, model: /^(canter|fuso)/, reason: "kamyonet" },
  { brand: /hyundai/, model: /^(hd\s?\d|mighty|county)/, reason: "kamyonet / midibüs" },
  { brand: /volvo/, model: /^(fh|fm|fmx|fl|fe|b\d{1,2}r?)\b/, reason: "kamyon / otobüs" },
  { brand: /renault/, model: /^(premium|magnum|kerax|midlum|trucks)/, reason: "kamyon" },
  { brand: /tata/, model: /^(lpt|lpk|ultra|prima)/, reason: "kamyon" },
  // Motosiklet / scooter (otomobil de üreten markalar)
  { brand: /honda/, model: /^(activa|pcx|forza|dio|vision|cbr|cbf|cb\s?\d|crf|nc\s?\d|africa|x-?adv|adv\s?\d|sh\s?\d|transalp|gold ?wing|rebel|msx|grom|spacy)/, reason: "motosiklet" },
  { brand: /suzuki/, model: /^(burgman|gsx|gsr|v-?strom|address|hayabusa|bandit|dr-?z|sv\s?\d)/, reason: "motosiklet" },
  { brand: /bmw/, model: /^(r\s?\d{3,4}|f\s?\d{3}\s?(gs|r|xr)|g\s?\d{3}|s\s?1000|k\s?1[36]00|c\s?(400|650)|ce\s?0\d)/, reason: "motosiklet" },
  { brand: /peugeot/, model: /^(kisbee|django|tweet|speedfight|metropolis|pulsion|citystar)/, reason: "motosiklet" },
];

/**
 * Kasa tipi (kaynağın yazımı) kapsam dışı bir türü anlatıyor mu? "Panelvan", "Minivan", "Kombi" kapsam içindedir;
 * "Minibüs", "Kamyonet", "Şasi kabin", "Pick-up" değildir.
 */
export function outOfScopeBodyType(raw?: string | null): string | null {
  const v = fold(raw);
  if (!v) return null;
  if (/pick-?\s?up|pikap|cift kabin|tek kabin|king cab|double cab/.test(v)) return "pickup";
  if (/kamyon|sasi|yandan yuklemeli|damper|cekici|tir\b|tenteli|frigorifik/.test(v)) return "kamyon / kamyonet";
  if (/otobus|midibus|minibus/.test(v)) return "otobüs / minibüs";
  if (/motosiklet|scooter|atv|utv|karavan|cekme karavan/.test(v)) return "motosiklet / ATV / karavan";
  return null;
}

export interface ScopeInput {
  brand?: string | null;
  model?: string | null;
  title?: string | null;
  bodyType?: string | null;
}

/** İlan platform kapsamı dışındaysa nedenini ("pickup", "kamyon / otobüs"...) döndürür; içindeyse null. */
export function outOfScopeReason(input: ScopeInput): string | null {
  const brand = fold(input.brand);
  if (!brand) return null;
  if (MOTO_BRANDS.has(brand)) return "motosiklet / ATV";
  if (HEAVY_BRANDS.has(brand)) return "kamyon / otobüs";
  // Ayrıştırma hatası: ilan sahibi türü marka sanılmış ("Sahibinden Karavan ...", "Galeriden ATV & UTV ...").
  if ((brand === "sahibinden" || brand === "galeriden") && /karavan|atv|utv|motosiklet|tarim|traktor|ticari|hat|plaka|kamyon|otobus|minibus/.test(fold(input.model))) {
    return "araç ilanı değil";
  }

  const body = outOfScopeBodyType(input.bodyType);
  if (body) return body;

  const model = fold(input.model);
  const family = fold(modelFamily(input.model, input.brand));
  for (const rule of OUT_OF_SCOPE_MODELS) {
    if (rule.brand.test(brand) && (rule.model.test(model) || rule.model.test(family))) return rule.reason;
  }
  return null;
}
