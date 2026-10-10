import { describe, expect, it } from "vitest";
import { parseRelease } from "./app-release";

const asset = { name: "otopiyasa-release.apk", browser_download_url: "https://example.com/otopiyasa-release.apk" };

describe("parseRelease", () => {
  it("sürüm kodunu gizli yorumdan, APK'yı ekten okur; yorum notta görünmez", () => {
    const parsed = parseRelease({
      tag_name: "v1.0.6",
      body: "<!-- versionCode: 7 -->\n• Yeni tasarım\n\n• Alt menü",
      published_at: "2026-10-07T10:00:00Z",
      assets: [asset],
    });
    expect(parsed).toMatchObject({
      version: "1.0.6",
      versionCode: 7,
      apkUrl: asset.browser_download_url,
      changelog: "• Yeni tasarım\n• Alt menü",
      releaseDate: "2026-10-07",
    });
  });

  it("sürüm kodu ya da APK yoksa kullanılmaz", () => {
    expect(parseRelease({ tag_name: "v1.0.6", body: "notlar", assets: [asset] })).toBeNull();
    expect(parseRelease({ tag_name: "v1.0.6", body: "versionCode: 7", assets: [] })).toBeNull();
  });

  it("zorunluluk kararı istemciye bırakılır: eşik gönderilir, forceUpdate sabit false kalır", () => {
    // Yanıt CDN'de herkese ortak saklandığı için "zorunlu mu" burada sabitlenemez; istemci
    // kendi derleme numarasını minVersionCode ile karşılaştırır (mobile/update_service.dart).
    const previous = process.env.APP_MIN_VERSION_CODE;
    process.env.APP_MIN_VERSION_CODE = "7";
    try {
      const parsed = parseRelease({ tag_name: "v1.0.6", body: "versionCode: 9", assets: [asset] });
      expect(parsed?.minVersionCode).toBe(7);
      expect(parsed?.forceUpdate).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.APP_MIN_VERSION_CODE;
      else process.env.APP_MIN_VERSION_CODE = previous;
    }
  });

  it("bölünmüş paketler varken evrensel paketi seçer (her telefona kurulabilir)", () => {
    // Yayın artık app-arm64-v8a / app-armeabi-v7a (küçük) ve otopiyasa-release (evrensel)
    // paketlerini birlikte içeriyor. GitHub varlıkları ada göre döndüğü için "ilk .apk"
    // seçilseydi yalnızca arm64 cihazlara kurulabilen paket dağıtılırdı.
    const arm64 = {
      name: "app-arm64-v8a-release.apk",
      browser_download_url: "https://example.com/app-arm64-v8a-release.apk",
    };
    const parsed = parseRelease({
      tag_name: "v1.0.16",
      body: "<!-- versionCode: 17 -->",
      assets: [arm64, asset],
    });
    expect(parsed?.apkUrl).toBe(asset.browser_download_url);
  });
});
