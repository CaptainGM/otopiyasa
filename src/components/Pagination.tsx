import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;

  params: Record<string, string>;
}

function hrefFor(params: Record<string, string>, page: number) {
  const query = new URLSearchParams(params);
  if (page <= 1) query.delete("page");
  else query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/?${qs}` : "/";
}


function pageWindow(page: number, totalPages: number): (number | "...")[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | "...")[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push("...");
    result.push(p);
    previous = p;
  }
  return result;
}

export function Pagination({ page, totalPages, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  const base =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-semibold transition";
  const idle = `${base} border-white/10 bg-white/5 text-slate-300 hover:border-amber-400/40 hover:text-amber-200`;
  const active = `${base} border-amber-400/40 bg-amber-400/15 text-amber-300`;
  const disabled = `${base} cursor-not-allowed border-white/5 text-slate-600`;

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Sayfalar">
      {page > 1 ? (
        <Link href={hrefFor(params, page - 1)} className={idle}>
          ← Önceki
        </Link>
      ) : (
        <span className={disabled}>← Önceki</span>
      )}

      {pageWindow(page, totalPages).map((item, index) =>
        item === "..." ? (
          <span key={`gap-${index}`} className="px-1 text-slate-600">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(params, item)}
            className={item === page ? active : idle}
            aria-current={item === page ? "page" : undefined}
          >
            {item}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link href={hrefFor(params, page + 1)} className={idle}>
          Sonraki →
        </Link>
      ) : (
        <span className={disabled}>Sonraki →</span>
      )}

  
      <form action="/" method="get" className="ml-2 flex items-center gap-1.5">
        {Object.entries(params)
          .filter(([key]) => key !== "page")
          .map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        <label htmlFor="page-jump" className="text-sm text-slate-500">
          Sayfaya git
        </label>
        <input
          id="page-jump"
          name="page"
          type="number"
          min={1}
          max={totalPages}
          defaultValue={page}
          aria-label={`Sayfa numarası (1-${totalPages})`}
          className="h-9 w-16 rounded-lg border border-white/10 bg-white/5 px-2 text-center text-sm text-slate-200"
        />
        <button type="submit" className={idle}>
          Git
        </button>
      </form>
    </nav>
  );
}
