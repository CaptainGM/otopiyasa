/**
 * Sitenin tek ikon seti: 24'lük ızgarada 1,6 çizgi kalınlığı, yuvarlak uçlar. Arayüzdeki emojilerin yerine
 * kullanılır (emoji her işletim sisteminde farklı çizilir ve koyu temada amatör durur).
 */
const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></>,
  car: <><path d="M4 16.5V12l1.8-4.6A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.4L20 12v4.5a1 1 0 0 1-1 1h-1.5M4 16.5a1 1 0 0 0 1 1h1.5M9.5 17.5h5M4 12h16" /><circle cx="8" cy="17.5" r="1.6" /><circle cx="16" cy="17.5" r="1.6" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  road: <><path d="M5 20 9 4M19 20 15 4M12 6v2.5M12 11v2.5M12 16v2.5" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  fuel: <><path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M4 20h12M5 10h10" /><path d="M15 8.5h1.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 0 3 0V9.5L18.5 7" /></>,
  gear: <><circle cx="6" cy="6" r="1.8" /><circle cx="12" cy="6" r="1.8" /><circle cx="18" cy="6" r="1.8" /><circle cx="6" cy="18" r="1.8" /><circle cx="12" cy="18" r="1.8" /><path d="M6 7.8v10.2M12 7.8v10.2M18 7.8V12H6" /></>,
  compare: <><path d="M7 4 3.5 7.5 7 11M3.5 7.5H15M17 13l3.5 3.5L17 20M20.5 16.5H9" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  share: <><circle cx="17.5" cy="5.5" r="2.3" /><circle cx="6.5" cy="12" r="2.3" /><circle cx="17.5" cy="18.5" r="2.3" /><path d="m8.5 10.8 7-4.1M8.5 13.2l7 4.1" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  doc: <><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" /><path d="M14 3.5V8h4M8.5 12.5h7M8.5 16h5" /></>,
  spark: <path d="M12 3.5 13.8 9a2 2 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a2 2 0 0 0-1.2 1.2L12 20.5 10.2 15a2 2 0 0 0-1.2-1.2L3.5 12 9 10.2A2 2 0 0 0 10.2 9z" />,
  chat: <><path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.6A7.5 7.5 0 1 1 20 12z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  map: <><path d="m9 4.5-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2z" /><path d="M9 4.5v13M15 6.5v13" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></>,
  warning: <><path d="M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  tag: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.1 6.1a1.5 1.5 0 0 1-2.1 0z" /><circle cx="8" cy="8" r="1.5" /></>,
  trendDown: <path d="M3.5 7.5 9.5 13.5l4-4 7 7M20.5 11.5v5h-5" />,
  trendUp: <path d="M3.5 16.5l6-6 4 4 7-7M20.5 12.5v-5h-5" />,
  pulse: <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />,
  thermo: <><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z" /><path d="M12 9v7" /></>,
  location: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /><circle cx="12" cy="12" r="7" /></>,
  expand: <path d="M14.5 4H20v5.5M9.5 20H4v-5.5M20 4l-6.5 6.5M4 20l6.5-6.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.6,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** Verilirse ekran okuyucu okur; verilmezse süs sayılır. */
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
