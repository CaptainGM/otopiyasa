export function deviceLabelFromUserAgent(userAgent: string | null | undefined): string {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return "Bilinmeyen cihaz";

  // OtoPiyasa Flutter mobil uygulaması özel bir User-Agent göndermiyor;
  // Dart'ın http paketi varsayılan olarak "Dart/x.x (dart:io)" gönderir.
  if (ua.includes("dart")) return "OtoPiyasa mobil uygulaması";

  let os = "";
  if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "Mac";
  else if (ua.includes("linux")) os = "Linux";

  let browser = "";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";

  const parts = [browser, os].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Bilinmeyen cihaz";
}
