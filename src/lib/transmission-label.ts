/**
 * Vites etiketi (gösterim). Kaynaklar aynı model için bazen "Otomatik" bazen "Yarı Otomatik" yazıyor (ör. Chery Tiggo 7 Pro 1.6 DCT:
 * 45 ilan "Yarı Otomatik", 14 ilan "Otomatik"); ilanı veren seçiyor. Alıcı için ikisi de debriyaj pedalı olmayan şanzımandır, bu yüzden
 * ekranda tek "Otomatik" gösterilir ve "Otomatik" filtresi ikisini de bulur. Veritabanındaki ham değer değişmez.
 */
export function displayTransmission<T extends string | null | undefined>(raw: T): T | string {
  const v = (raw || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
  return /^(yari|semi)/.test(v) ? "Otomatik" : raw;
}

/** "Otomatik" ya da "Yarı Otomatik" seçilince bulunacak ham değerler (Mongo desen metni). */
export const AUTOMATIC_TRANSMISSION_PATTERN = "^(otomatik|automatic|yarı otomatik|tiptronik|tiptronic|multitronik|multitronic|steptronik|steptronic|cvt|dct|dsg|edc|powershift|s tronic)$";
