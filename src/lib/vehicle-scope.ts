import { modelFamily } from "@/lib/model-family";

/**
 * ARAÇ TİPİ VE PLATFORM KAPSAMI (kullanıcı kararı, 2026-10-06 akşam): OtoPiyasa kara taşıtlarının hepsini kapsar:
 * otomobil, arazi/SUV/pickup, minivan & panelvan, ticari araçlar (kamyon, kamyonet, minibüs, otobüs...), motosiklet
 * ve karavan. Kapsam dışı: ATV/UTV, deniz ve hava araçları, kiralık ilanlar, tarım/iş makineleri ve araç olmayan
 * ilanlar ("taksi hat & plaka"). Her ilanın bir araç tipi vardır; liste filtreleri, analiz ve piyasa ortalamaları
 * tipleri birbirine karıştırmaz.
 */

export type VehicleClass = "otomobil" | "suv-pickup" | "minivan-panelvan" | "ticari" | "motosiklet" | "karavan";

export const VEHICLE_CLASSES: ReadonlyArray<{ value: VehicleClass; label: string }> = [
  { value: "otomobil", label: "Otomobil" },
  { value: "suv-pickup", label: "Arazi, SUV & Pickup" },
  { value: "minivan-panelvan", label: "Minivan & Panelvan" },
  { value: "ticari", label: "Ticari Araçlar" },
  { value: "motosiklet", label: "Motosiklet" },
  { value: "karavan", label: "Karavan" },
];

/** Binek tipleri: piyasa analizi ve genel fiyat göstergeleri bunlardan hesaplanır (motosiklet/kamyon ortalamayı bozmasın). */
export const PASSENGER_CLASSES: VehicleClass[] = ["otomobil", "suv-pickup", "minivan-panelvan"];

export const isVehicleClass = (value: unknown): value is VehicleClass =>
  typeof value === "string" && VEHICLE_CLASSES.some((c) => c.value === value);

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

/** Kaynak kategori yolundaki kapsam dışı türler (Arabam: "atv", "utv", "deniz-araclari", "kiralik-araclar"...). */
const EXCLUDED_CATEGORY = /(^|[/-])(atv|utv|deniz|hava-arac|kiralik|hat-plaka|tarim|is-makina|traktor|yedek-parca|bisiklet)/;

/** Kaynağın kategori yolundan araç tipi ("otomobil", "arazi-suv-pick-up/toyota-hilux", "motosiklet/yamaha"...). */
export function classFromSourceCategory(path?: string | null): VehicleClass | "excluded" | null {
  const v = fold(path);
  if (!v) return null;
  if (EXCLUDED_CATEGORY.test(v)) return "excluded";
  const top = v.split("/")[0];
  if (top.startsWith("arazi") || top.includes("suv") || top.includes("pick")) return "suv-pickup";
  if (top.startsWith("minivan") || top.includes("panelvan")) return "minivan-panelvan";
  if (top.startsWith("ticari")) return "ticari";
  if (top.startsWith("motosiklet")) return "motosiklet";
  if (top.startsWith("karavan")) return "karavan";
  if (top.startsWith("otomobil") || top.startsWith("klasik") || top.startsWith("hasarli") || top.startsWith("engelli")) return "otomobil";
  return null;
}

/** Yalnızca ATV/UTV üreten markalar. */
const ATV_BRANDS = new Set(["polaris", "can-am", "can am", "linhai", "hisun", "segway", "arctic cat", "tgb"].map(fold));

/** Yalnızca motosiklet/scooter üreten markalar (otomobil üretmeyen). */
const MOTO_BRANDS = new Set(
  [
    "yamaha", "bajaj", "kymco", "tvs", "mondial", "rks", "arora", "yuki", "kuba", "apec", "kawasaki", "ducati",
    "harley-davidson", "harley davidson", "ktm", "piaggio", "vespa", "cfmoto", "cf moto", "benelli", "triumph",
    "royal enfield", "sym", "hero", "kanuni", "falcon", "motolux", "husqvarna", "aprilia", "mv agusta", "zontes",
    "voge", "beta", "gasgas", "keeway", "lifan moto",
  ].map(fold)
);

/** Kamyon, otobüs ve ağır ticari üreticileri. */
const HEAVY_BRANDS = new Set(
  [
    "ford trucks", "bmc", "man", "scania", "daf", "iveco", "iveco-otoyol", "iveco - otoyol", "otoyol", "otokar", "temsa",
    "hino", "renault trucks", "volvo trucks", "fuso", "mitsubishi fuso", "isuzu-anadolu", "guleryuz",
  ].map(fold)
);

/** Marka + model ailesi bazında tip kuralları (kaynak kategori ve kasa tipi bilinmiyorsa). */
const MODEL_RULES: Array<{ brand: RegExp; model: RegExp; cls: VehicleClass }> = [
  // Pickup'lar
  { brand: /toyota/, model: /^(hilux|tacoma|tundra)/, cls: "suv-pickup" },
  { brand: /ford/, model: /^(ranger|f-?\s?150|f-?\s?250|maverick)/, cls: "suv-pickup" },
  { brand: /nissan/, model: /^(navara|np\s?300|king cab|pick)/, cls: "suv-pickup" },
  // "L 300" panelvan aynı "L Serisi" ailesinde; yalnızca L 200 pickup'tır.
  { brand: /mitsubishi/, model: /^(l\s?200|strakar|triton)/, cls: "suv-pickup" },
  { brand: /^isuzu/, model: /^(d-?\s?max|tf\b|kb\b)/, cls: "suv-pickup" },
  { brand: /volkswagen/, model: /^amarok/, cls: "suv-pickup" },
  { brand: /fiat/, model: /^(fullback|strada|toro)/, cls: "suv-pickup" },
  { brand: /mazda/, model: /^(bt-?\s?50|b\s?serisi|b\s?2500)/, cls: "suv-pickup" },
  { brand: /mercedes/, model: /^(x[\s-]?(\d{3}|serisi|sinifi|class)|x$)/, cls: "suv-pickup" },
  { brand: /ssangyong|kg mobility/, model: /^(actyon sports|korando sports|musso|rexton sports)/, cls: "suv-pickup" },
  { brand: /great wall|gwm/, model: /^(poer|steed|wingle)/, cls: "suv-pickup" },
  { brand: /renault/, model: /^alaskan/, cls: "suv-pickup" },
  { brand: /peugeot/, model: /^landtrek/, cls: "suv-pickup" },
  { brand: /chevrolet/, model: /^(colorado|silverado)/, cls: "suv-pickup" },
  { brand: /dodge|^ram$/, model: /^(ram|dakota)/, cls: "suv-pickup" },
  { brand: /jeep/, model: /^gladiator/, cls: "suv-pickup" },
  // Kamyon / otobüs / kamyonet
  { brand: /^isuzu/, model: /^(npr|nqr|nkr|npk|nlr|nnr|novo|turquoise|citiport|grafter|m-?max|n-?wide|anadolu)/, cls: "ticari" },
  { brand: /mercedes/, model: /^(actros|axor|atego|arocs|antos|unimog|econic|travego|tourismo|intouro|conecto|citaro|o\s?\d{3})/, cls: "ticari" },
  { brand: /mitsubishi/, model: /^(canter|fuso)/, cls: "ticari" },
  { brand: /hyundai/, model: /^(hd\s?\d|mighty|county)/, cls: "ticari" },
  { brand: /volvo/, model: /^(fh|fm|fmx|fl|fe|b\d{1,2}r?)\b/, cls: "ticari" },
  { brand: /renault/, model: /^(premium|magnum|kerax|midlum|trucks)/, cls: "ticari" },
  { brand: /tata/, model: /^(lpt|lpk|ultra|prima)/, cls: "ticari" },
  // Minivan & panelvan (hafif ticari; kaynak kategorisi okunana kadar modelden)
  { brand: /fiat/, model: /^(doblo|fiorino|ducato|scudo|talento|qubo)/, cls: "minivan-panelvan" },
  { brand: /renault/, model: /^(kangoo|trafic|master|express)/, cls: "minivan-panelvan" },
  { brand: /dacia/, model: /^dokker/, cls: "minivan-panelvan" },
  { brand: /volkswagen/, model: /^(caddy|transporter|caravelle|multivan|crafter|california)/, cls: "minivan-panelvan" },
  { brand: /ford/, model: /^(transit|tourneo)/, cls: "minivan-panelvan" },
  { brand: /citroen/, model: /^(berlingo|nemo|jumpy|jumper|spacetourer)/, cls: "minivan-panelvan" },
  { brand: /peugeot/, model: /^(partner|rifter|bipper|expert|boxer|traveller)/, cls: "minivan-panelvan" },
  { brand: /opel/, model: /^(combo|vivaro|movano|zafira life)/, cls: "minivan-panelvan" },
  { brand: /mercedes/, model: /^(vito|viano|v\s?\d{3}|v[\s-]?(serisi|sinifi|class)|sprinter|citan)/, cls: "minivan-panelvan" },
  { brand: /toyota/, model: /^(proace|hiace)/, cls: "minivan-panelvan" },
  { brand: /hyundai/, model: /^(h-?\s?1\b|h-?\s?100|starex|staria)/, cls: "minivan-panelvan" },
  { brand: /nissan/, model: /^(nv\s?\d{3}|primastar|evalia)/, cls: "minivan-panelvan" },
  { brand: /mitsubishi/, model: /^l\s?300/, cls: "minivan-panelvan" },
  { brand: /iveco/, model: /^daily/, cls: "ticari" },
  // Motosiklet / scooter (otomobil de üreten markalar)
  { brand: /honda/, model: /^(activa|pcx|forza|dio|vision|cbr|cbf|cb\s?\d|crf|nc\s?\d|africa|x-?adv|adv\s?\d|sh\s?\d|transalp|gold ?wing|rebel|msx|grom|spacy)/, cls: "motosiklet" },
  { brand: /suzuki/, model: /^(burgman|gsx|gsr|v-?strom|address|hayabusa|bandit|dr-?z|sv\s?\d)/, cls: "motosiklet" },
  { brand: /bmw/, model: /^(r\s?\d{3,4}|f\s?\d{3}\s?(gs|r|xr)|g\s?\d{3}|s\s?1000|k\s?1[36]00|c\s?(400|650)|ce\s?0\d)/, cls: "motosiklet" },
  { brand: /peugeot/, model: /^(kisbee|django|tweet|speedfight|metropolis|pulsion|citystar)/, cls: "motosiklet" },
];

/** Kasa tipinden araç tipi (kaynağın yazımı). */
export function classFromBodyType(raw?: string | null): VehicleClass | "excluded" | null {
  const v = fold(raw);
  if (!v) return null;
  if (/\batv\b|\butv\b/.test(v)) return "excluded";
  if (/motosiklet|scooter|chopper|enduro|naked|cross motor/.test(v)) return "motosiklet";
  if (/karavan|motokaravan/.test(v)) return "karavan";
  if (/kamyon|sasi|yandan yuklemeli|damper|cekici|tir\b|tenteli|frigorifik|otobus|midibus|minibus/.test(v)) return "ticari";
  if (/pick-?\s?up|pikap|cift kabin|tek kabin|king cab|double cab|suv|arazi|crossover|cross over|hard top/.test(v)) return "suv-pickup";
  if (/panelvan|panel van|minivan|camli ?van|kombi|combi|mpv|\bvan\b/.test(v)) return "minivan-panelvan";
  return null;
}

export interface ScopeInput {
  brand?: string | null;
  model?: string | null;
  title?: string | null;
  bodyType?: string | null;
  /** Kaynağın kategori yolu (Arabam gezinme yolu / liste verisi). */
  sourceCategory?: string | null;
}

/** İlan platform kapsamı dışındaysa nedenini döndürür; içindeyse null. */
export function outOfScopeReason(input: ScopeInput): string | null {
  if (classFromSourceCategory(input.sourceCategory) === "excluded") return "kapsam dışı kategori (ATV, deniz/hava aracı, kiralık...)";
  const brand = fold(input.brand);
  if (ATV_BRANDS.has(brand)) return "ATV / UTV";
  if (classFromBodyType(input.bodyType) === "excluded") return "ATV / UTV";
  // Ayrıştırma hatası: ilan sahibi türü marka sanılmış ("Galeriden ATV & UTV ...", "Sahibinden Ticari Araçlar Hat & Plaka").
  const text = fold(`${input.model || ""} ${input.title || ""}`);
  if ((brand === "sahibinden" || brand === "galeriden") && /\batv\b|\butv\b|tarim|traktor|hat\s*&?\s*plaka|plaka|deniz|tekne/.test(text)) {
    return "araç ilanı değil";
  }
  if (/hat\s*&\s*plaka|taksi plakasi|dolmus plakasi/.test(text)) return "araç ilanı değil";
  return null;
}

/**
 * İlanın araç tipi. Öncelik: kaynağın kategorisi > kasa tipi > marka/model kuralları > "otomobil".
 * (Kapsam dışı ilanlar için önce outOfScopeReason çağrılmalıdır.)
 */
export function vehicleClassOf(input: ScopeInput): VehicleClass {
  const fromCategory = classFromSourceCategory(input.sourceCategory);
  if (fromCategory && fromCategory !== "excluded") return fromCategory;

  const brand = fold(input.brand);
  if (MOTO_BRANDS.has(brand)) return "motosiklet";
  if (HEAVY_BRANDS.has(brand)) return "ticari";

  // Kasa tipi kamyonet/minibüs/motosiklet/karavan diyorsa model kuralından güçlüdür (şasi kabin Transit ticaridir).
  const fromBody = classFromBodyType(input.bodyType);
  if (fromBody === "ticari" || fromBody === "motosiklet" || fromBody === "karavan") return fromBody;

  const model = fold(input.model);
  const family = fold(modelFamily(input.model, input.brand));
  for (const rule of MODEL_RULES) {
    if (rule.brand.test(brand) && (rule.model.test(model) || rule.model.test(family))) return rule.cls;
  }

  if (fromBody && fromBody !== "excluded") return fromBody;

  if (/karavan/.test(fold(`${input.model || ""} ${input.title || ""}`))) return "karavan";
  return "otomobil";
}
