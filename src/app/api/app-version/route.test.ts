import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Her testte modül yeniden yüklenir: route içindeki 30 dakikalık bellek önbelleği testler arasında taşınmasın.
async function loadGet() {
  vi.resetModules();
  return (await import("./route")).GET;
}

/** Route artık isteği okuduğu için (abi parametresi) istek nesnesi gerekiyor. */
function request(abi?: string) {
  const url = abi ? `https://otopiyasa.app/api/app-version?abi=${abi}` : "https://otopiyasa.app/api/app-version";
  return new Request(url);
}

const universalAsset = {
  name: "otopiyasa-release.apk",
  browser_download_url: "https://github.com/x/otopiyasa-release.apk",
};
const arm64Asset = {
  name: "app-arm64-v8a-release.apk",
  browser_download_url: "https://github.com/x/app-arm64-v8a-release.apk",
};

function stubRelease(assets: Array<{ name: string; browser_download_url: string }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            tag_name: "v1.0.6",
            body: "<!-- versionCode: 7 -->\n• Yeni tasarım",
            published_at: "2026-10-07T10:00:00Z",
            assets,
          }),
          { status: 200 }
        )
    )
  );
}

describe("GET /api/app-version", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("en son GitHub yayınını okur (sürüm kodu yayın notundan, APK ekten)", async () => {
    stubRelease([universalAsset]);
    const GET = await loadGet();
    const data = await (await GET(request())).json();
    expect(data).toMatchObject({
      version: "1.0.6",
      versionCode: 7,
      apkUrl: "https://github.com/x/otopiyasa-release.apk",
      changelog: "• Yeni tasarım",
      forceUpdate: false,
    });
  });

  it("abi verilirse mimariye bölünmüş küçük paketi döner", async () => {
    // Uygulama içi güncellemenin 65 MB yerine ~23 MB indirmesini sağlayan yol.
    stubRelease([arm64Asset, universalAsset]);
    const GET = await loadGet();
    const data = await (await GET(request("arm64-v8a"))).json();
    expect(data.apkUrl).toBe("https://github.com/x/app-arm64-v8a-release.apk");
  });

  it("abi verilmezse ya da tanınmıyorsa evrensel pakete düşer", async () => {
    stubRelease([arm64Asset, universalAsset]);
    const GET = await loadGet();
    expect((await (await GET(request())).json()).apkUrl).toBe(universalAsset.browser_download_url);
    expect((await (await GET(request("x86_64"))).json()).apkUrl).toBe(universalAsset.browser_download_url);
    expect((await (await GET(request("../../etc/passwd"))).json()).apkUrl).toBe(universalAsset.browser_download_url);
  });

  it("GitHub'a ulaşılamazsa varsayılan sürümü döner", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ağ yok"); }));
    const GET = await loadGet();
    const res = await GET(request());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.version).toBe("1.0.2");
    expect(data.versionCode).toBe(3);
    expect(data.apkUrl).toContain("otopiyasa-release.apk");
    expect(data.forceUpdate).toBe(false);
  });

  it("yedek yolda da abi'ye uyan paket adresi verilir", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const GET = await loadGet();
    const data = await (await GET(request("arm64-v8a"))).json();
    expect(data.apkUrl).toContain("app-arm64-v8a-release.apk");
  });

  it("GitHub'a ulaşılamazsa ortam değişkenlerini kullanır", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    vi.stubEnv("APP_LATEST_VERSION", "2.0.0");
    vi.stubEnv("APP_LATEST_VERSION_CODE", "5");
    vi.stubEnv("APP_APK_URL", "https://example.com/custom.apk");
    const GET = await loadGet();
    const data = await (await GET(request("arm64-v8a"))).json();
    expect(data.version).toBe("2.0.0");
    expect(data.versionCode).toBe(5);
    // Özel adres verilmişse mimari ayrımı yapılmaz.
    expect(data.apkUrl).toBe("https://example.com/custom.apk");
  });
});
