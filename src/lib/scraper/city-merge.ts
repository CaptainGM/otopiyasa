/** A missing or adapter-guessed city must never replace a saved city. */
export function verifiedCityUpdate(
  existingCity: string | undefined,
  incomingCity: string | undefined,
  cityVerified?: boolean
): string | undefined {
  const city = (incomingCity || "").trim();
  const key = city.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (cityVerified !== true || !city || ["turkiye", "bilinmiyor", "belirtilmemis", "-", "n/a"].includes(key)) {
    return undefined;
  }
  return existingCity === city ? undefined : city;
}
