import { ListingSource } from "@/types";

const labels: Record<ListingSource, string> = {
  sahibinden: "Sahibinden",
  arabam: "Arabam",
  otomerkezi: "Otomerkezi",
  vavacars: "VavaCars",
  otoplus: "Otoplus",
  carvak: "Carvak",
  otokoc: "Otokoç 2. El",
  dod: "DOD",
  ikinciyeni: "İkinciyeni",
  demo: "Demo",
  manual: "Manuel",
  user: "Üye İlanı",
};

const colors: Record<ListingSource, string> = {
  sahibinden: "bg-yellow-400/15 text-yellow-200 border-yellow-400/25",
  arabam: "bg-orange-400/15 text-orange-200 border-orange-400/25",
  otomerkezi: "bg-sky-400/15 text-sky-200 border-sky-400/25",
  vavacars: "bg-purple-500/15 text-purple-200 border-purple-500/25",
  otoplus: "bg-rose-500/15 text-rose-200 border-rose-500/25",
  carvak: "bg-teal-500/15 text-teal-200 border-teal-500/25",
  otokoc: "bg-indigo-500/15 text-indigo-200 border-indigo-500/25",
  dod: "bg-blue-600/15 text-blue-200 border-blue-500/25",
  ikinciyeni: "bg-emerald-500/15 text-emerald-200 border-emerald-500/25",
  demo: "bg-slate-400/15 text-slate-200 border-slate-400/25",
  manual: "bg-violet-400/15 text-violet-200 border-violet-400/25",
  user: "bg-emerald-400/15 text-emerald-200 border-emerald-400/25",
};

export function SourceBadge({ source }: { source: ListingSource }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${colors[source]}`}
    >
      {labels[source]}
    </span>
  );
}
