"use client";

import { Children, isValidElement, type ReactElement, type ReactNode, useEffect, useState, useTransition } from "react";

interface PanelProps {
  id: string;
  label: string;
  badge?: number;
  children: ReactNode;
}

/**
 * Yönetim paneli sekmesi. Yalnızca tanımlama taşır: AdminTabs çocuğun props'unu okuyup içeriğini çizer.
 * İçerik sunucuda üretilir; sekme değişince gizlenir (hidden), durumu kaybolmaz.
 */
export function AdminTabPanel(_props: PanelProps) {
  return null;
}

/** Eski bağlantılar için: #admin-comments bağlantısı "mod" sekmesini açar. */
const HASH_TO_TAB: Record<string, string> = { "admin-comments": "mod" };

export function AdminTabs({ children, defaultTab }: { children: ReactNode; defaultTab: string }) {
  const panels = Children.toArray(children).filter(isValidElement) as ReactElement<PanelProps>[];
  const ids = panels.map((panel) => panel.props.id);
  const [active, setActive] = useState(defaultTab);
  const [visited, setVisited] = useState<Set<string>>(() => new Set([defaultTab]));
  const [, startTransition] = useTransition();

  function select(id: string) {
    if (!ids.includes(id)) return;
    setVisited((prev) => new Set(prev).add(id));
    startTransition(() => {
      setActive(id);
    });
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    const hashTab = () => HASH_TO_TAB[window.location.hash.slice(1)];
    const start = hashTab() ?? new URLSearchParams(window.location.search).get("tab") ?? defaultTab;
    if (ids.includes(start)) {
      setActive(start);
      setVisited((prev) => new Set(prev).add(start));
    }
    if (hashTab()) {
      window.setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" }), 0);
    }
    const onHash = () => {
      const target = hashTab();
      if (target && ids.includes(target)) {
        select(target);
        window.setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" }), 0);
      }
    };
    window.addEventListener("hashchange", onHash);

    // İlk sekme açıldıktan sonra kullanıcı Genel sekmesini incelerken,
    // diğer sekmeleri sırayla arka planda hazırlar. Böylece tıklandığında ANINDA açılır.
    const queue = ids.filter((id) => id !== start);
    let queueIdx = 0;
    let timer: number | undefined;

    function prewarmNext() {
      if (queueIdx >= queue.length) return;
      const nextId = queue[queueIdx++];
      setVisited((prev) => new Set(prev).add(nextId));
      timer = window.setTimeout(prewarmNext, 450);
    }

    timer = window.setTimeout(prewarmNext, 800);

    return () => {
      window.removeEventListener("hashchange", onHash);
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Yönetim bölümleri" className="flex gap-2 overflow-x-auto pb-1">
        {panels.map((panel) => {
          const { id, label, badge } = panel.props;
          const selected = id === active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`admin-panel-${id}`}
              onClick={() => select(id)}
              className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                selected
                  ? "border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-sm"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-amber-400/40 hover:text-amber-200"
              }`}
            >
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-200">{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {panels.map((panel) => {
        const isCurrent = panel.props.id === active;
        const hasVisited = visited.has(panel.props.id);
        return (
          <div
            key={panel.props.id}
            id={`admin-panel-${panel.props.id}`}
            role="tabpanel"
            hidden={!isCurrent}
            className="space-y-8"
          >
            {hasVisited ? panel.props.children : null}
          </div>
        );
      })}
    </div>
  );
}
