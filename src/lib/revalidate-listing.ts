import { revalidatePath } from "next/cache";

/**
 * İlan sayfası önbellekte (30 dk) durduğu için ilan değişince (onay, düzenleme, satıldı, silme, arşiv)
 * sayfayı hemen yenile; aksi hâlde eski hâli yarım saat görünürdü.
 */
export function revalidateListing(id: unknown): void {
  try {
    revalidatePath(`/cars/${String(id)}`);
  } catch {
    // betiklerden (Next dışından) çağrılırsa sessizce geç
  }
}
