import Link from "next/link";
import { CarStrip, MiniCarCard } from "@/components/CarStrip";
import { Icon } from "@/components/Icon";
import { getDealStrip } from "@/lib/deal-strip";

export async function DealsStrip() {
  const { items, total } = await getDealStrip().catch(() => ({ items: [], total: 0 }));
  if (items.length === 0) return null;

  return (
    <CarStrip
      eyebrow={`Piyasanın altında · ${total.toLocaleString("tr-TR")} ilan`}
      title="Haftanın fırsatları"
      aside={
        total > items.length ? (
          <Link href="/?firsat=1" className="btn btn-ghost text-sm">
            Tümünü gör ({total.toLocaleString("tr-TR")})
            <Icon name="arrowRight" size={15} />
          </Link>
        ) : undefined
      }
    >
      {items.map(({ car, label }) => (
        <MiniCarCard key={car._id} car={car} tag={label} tone="cheap" />
      ))}
    </CarStrip>
  );
}
