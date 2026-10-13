import type { VerifyListingResult } from "@/lib/scraper/verify-listing";

/**
 * Arabam tek tek ilan doğrulamasında "kaldırılmış" kanıtının gücü (bkz. VerifyListingResult.strong).
 *
 * Güçlü kanıt: HTTP 404/410, kategori sayfasına yönlendirme, platform dışı ilan. Bunlar sitenin kendi "ilan yok" cevabıdır;
 * engel ya da bot sayfası değildir, bu yüzden devre kesiciye takılmadan arşivlenir.
 *
 * Zayıf kanıt: sayfanın sonsuz yönlendirme döngüsüne girmesi (net::ERR_TOO_MANY_REDIRECTS). Kaldırılmış ilanların bir kısmında
 * Arabam böyle davranıyor (13 Ekim 2026'da doğrulanmamış 583 ilanın örneğinin üçte biri); ama aynı hata geçici bir engelde de
 * çıkabilir. Bu yüzden tek seferde arşivlenmez, bir sonraki kontrolde de aynıysa güçlü sayılır (bkz. promoteRepeatedGone).
 *
 * Eskiden bu hata "engel" sayılıyordu: art arda engel molası 15 → 120 dk'ya çıkıp bekçiyi saatlerce durduruyordu.
 */
export function arabamNavigationVerdict(message: string): VerifyListingResult {
  if (/ERR_TOO_MANY_REDIRECTS/.test(message)) {
    return {
      status: "gone",
      strong: false,
      reason: "Sayfa sonsuz yönlendirme döngüsüne giriyor (ilan kaldırılmış olabilir); bir sonraki kontrolde de aynıysa arşivlenir.",
    };
  }
  return { status: "blocked", reason: `Tarayıcı doğrulaması başarısız (ilan korunur): ${message}` };
}

/**
 * Zayıf kanıtla "kaldırılmış" görünüp önceki kontrolde de "gone-held" olarak bekletilen ilan bu kez de aynı sonucu verirse,
 * iki bağımsız kontrol (en az bir doğrulama aralığı arayla) birbirini doğrulamış sayılır ve güçlü kanıta yükseltilir.
 */
export function promoteRepeatedGone(result: VerifyListingResult, previousStatus: string | null | undefined): VerifyListingResult {
  if (result.status === "gone" && result.strong === false && previousStatus === "gone-held") {
    return { ...result, strong: true, reason: `${result.reason} İkinci kontrolde de aynı.` };
  }
  return result;
}
