
export const PUBLIC_LISTING_FILTER = {
  status: "active",
  moderationStatus: { $nin: ["pending", "rejected"] },
  // Yazım hatası gibi görünen fiyatlı ilanlar (bkz. price-plausibility.ts) herkese açık yerlerde gösterilmez.
  priceSuspect: { $ne: true },
  // Kilometresi yazım hatası gibi görünen ilanlar (bkz. price-plausibility.ts) da herkese açık yerlerde gösterilmez.
  mileageSuspect: { $ne: true },
  // Segment tavanını aşan fiyatlı ilanlar da herkese açık yerlerde gösterilmez (bkz. segment-cap.ts).
  segmentSuspect: { $ne: true },
} as const;

/**
 * Piyasa analizi kapsamı: herkese açık binek ilanlar (otomobil, arazi/SUV/pickup, minivan & panelvan). Motosiklet,
 * kamyon ve karavan fiyatları "piyasa ortalaması"nı bozmasın diye genel göstergelere katılmaz (bkz. vehicle-scope.ts).
 */
export const MARKET_LISTING_FILTER = {
  ...PUBLIC_LISTING_FILTER,
  // Araç tipi alanı eklenmeden önceki ilanlar otomobildir; null/$in bunları da kapsar.
  vehicleClass: { $in: ["otomobil", "suv-pickup", "minivan-panelvan", null] },
} as const;
