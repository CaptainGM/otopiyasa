import { describe, expect, it } from "vitest";
import { isSupportedAbi, minVersionCode, parseRelease, pickApkAsset } from "./app-release";

const asset = { name: "otopiyasa-release.apk", browser_download_url: "https://example.com/otopiyasa-release.apk" };
const arm64 = { name: "app-arm64-v8a-release.apk", browser_download_url: "https://example.com/app-arm64-v8a-release.apk" };
const armeabi = { name: "app-armeabi-v7a-release.apk", browser_download_url: "https://example.com/app-armeabi-v7a-release.apk" };

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
});

describe("minVersionCode", () => {
  it("tanımsız/geçersiz değerde 1 döner (kimse zorlanmaz)", () => {
    const previous = process.env.APP_MIN_VERSION_CODE;
    try {
      delete process.env.APP_MIN_VERSION_CODE;
      expect(minVersionCode()).toBe(1);
      process.env.APP_MIN_VERSION_CODE = "abc";
      expect(minVersionCode()).toBe(1);
      process.env.APP_MIN_VERSION_CODE = "0";
      expect(minVersionCode()).toBe(1);
      process.env.APP_MIN_VERSION_CODE = "12";
      expect(minVersionCode()).toBe(12);
    } finally {
      if (previous === undefined) delete process.env.APP_MIN_VERSION_CODE;
      else process.env.APP_MIN_VERSION_CODE = previous;
    }
  });
});

describe("pickApkAsset", () => {
  const assets = [arm64, armeabi, asset];

  it("istemci mimarisini bildirdiyse küçük bölünmüş paketi seçer", () => {
    // Uygulama içi güncelleme bu sayede 65 MB yerine ~23 MB indirir.
    expect(pickApkAsset(assets, "arm64-v8a")).toBe(arm64);
    expect(pickApkAsset(assets, "armeabi-v7a")).toBe(armeabi);
  });

  it("mimari bildirilmediyse evrensel pakete düşer (her telefona kurulabilir)", () => {
    expect(pickApkAsset(assets, undefined)).toBe(asset);
    expect(pickApkAsset(assets, "x86_64")).toBe(asset);
    expect(pickApkAsset(assets, "")).toBe(asset);
  });

  it("istenen mimarinin paketi yayında yoksa evrensel pakete düşer", () => {
    expect(pickApkAsset([armeabi, asset], "arm64-v8a")).toBe(asset);
    expect(pickApkAsset([arm64], undefined)).toBe(arm64);
  });

  it("hiç APK yoksa undefined döner", () => {
    expect(pickApkAsset([], "arm64-v8a")).toBeUndefined();
    expect(pickApkAsset(undefined, "arm64-v8a")).toBeUndefined();
  });
});

describe("isSupportedAbi", () => {
  it("yalnızca yayında paketi olan mimarileri kabul eder", () => {
    expect(isSupportedAbi("arm64-v8a")).toBe(true);
    expect(isSupportedAbi("armeabi-v7a")).toBe(true);
    expect(isSupportedAbi("x86_64")).toBe(false);
    expect(isSupportedAbi(undefined)).toBe(false);
    expect(isSupportedAbi("../../etc/passwd")).toBe(false);
  });
});
