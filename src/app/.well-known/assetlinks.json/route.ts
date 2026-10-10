import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Android App Links doğrulaması. Parmak izleri YAYINDAKİ APK'nın imzasıyla birebir eşleşmek
 * zorundadır; eşleşmezse https://otopiyasa.app/cars/<id> bağlantıları uygulamada açılmaz.
 *
 * Yayın APK'sı debug anahtarıyla imzalanıyor (bkz. .github/workflows/mobile-release.yml) ve o
 * anahtarın SHA-256'sı 350E:8EE5...76F4. Dosyadaki eski parmak izi (14:26:0D...) hiçbir yayında
 * kullanılmadı ve doğrulamayı düşürüyordu; geçmiş sürümlerle uyum için bırakıldı. Yeni bir
 * anahtara geçilirse buraya onun parmak izi eklenmeli:
 *   keytool -list -v -keystore <dosya> -alias <alias>
 */
const SHA256_FINGERPRINTS = [
  // Yayındaki APK'nın imzası (apksigner --print-certs ile aynı, iki nokta üst üste ile yazılır).
  "35:0E:8E:E5:EF:27:F1:22:DC:62:23:0B:53:E6:D4:3C:D1:36:5C:55:44:75:F1:FC:0C:EE:40:9D:85:1F:76:F4",
  // Eski kayıt; doğrulamayı etkilemez.
  "14:26:0D:37:A6:49:15:3F:89:D2:C3:FF:11:03:7E:6D:FE:B3:26:95:F4:96:A2:AE:31:01:46:1D:91:AA:A0:DF",
];

export async function GET() {
  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.otopiyasa.otopiyasa",
        sha256_cert_fingerprints: SHA256_FINGERPRINTS,
      },
    },
  ];

  return NextResponse.json(assetlinks, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
