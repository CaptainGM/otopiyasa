import type { AvatarDescriptor } from "@/lib/avatar";

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toLocaleUpperCase("tr-TR") || "?"
  );
}

/** Profil rozeti: hazır avatar ya da yüklenen fotoğraf (ikisi de bir adresten gelir), yoksa baş harfler. Sunucu ve istemci bileşenlerinde kullanılabilir. */
export function Avatar({
  name,
  avatar,
  size = 40,
  className = "",
}: {
  name: string;
  avatar?: AvatarDescriptor;
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.28) };

  if (avatar?.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar.url} alt="" width={size} height={size} style={box} className={`shrink-0 bg-white/5 object-cover ${className}`} />;
  }

  return (
    <span
      style={{ ...box, fontSize: Math.round(size * 0.38) }}
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500 font-black text-[#221202] ${className}`}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}
