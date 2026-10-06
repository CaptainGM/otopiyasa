import { isUnknownFeature, PENDING_FEATURE_LABEL } from "@/lib/scraper/feature-merge";

export const PENDING_CHIP_LABEL = "Özellikler doğrulanıyor";

/**
 * Kartlardaki özellik etiketleri: bilinmeyen değer ("Bilinmiyor", "Belirtilmemiş") gösterilmez; henüz kaynaktan
 * okunmamış olanlar tek bir "Özellikler doğrulanıyor" etiketinde toplanır (yan yana etiketsiz "Doğrulanıyor"
 * yazıları hangi özelliğin beklendiğini anlatmıyordu).
 */
export function featureChips(values: Array<string | null | undefined>): Array<{ label: string; pending: boolean }> {
  const chips = values
    .filter((v): v is string => typeof v === "string" && v !== PENDING_FEATURE_LABEL && !isUnknownFeature(v))
    .map((label) => ({ label, pending: false }));
  if (values.includes(PENDING_FEATURE_LABEL)) chips.push({ label: PENDING_CHIP_LABEL, pending: true });
  return chips;
}
