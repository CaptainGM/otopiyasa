import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Her testte modül yeniden yüklenir: route içindeki 30 dakikalık bellek önbelleği testler arasında taşınmasın.
async function loadGet() {
  vi.resetModules();
  return (await import("./route")).GET;
}

describe("GET /api/app-version", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("en son GitHub yayınını okur (sürüm kodu yayın notundan, APK ekten)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            tag_name: "v1.0.6",
            body: "<!-- versionCode: 7 -->\n• Yeni tasarım",
            published_at: "2026-10-07T10:00:00Z",
            assets: [{ name: "otopiyasa-release.apk", browser_download_url: "https://github.com/x/otopiyasa-release.apk" }],
          }),
          { status: 200 }
        )
      )
    );
    const GET = await loadGet();
    const data = await (await GET()).json();
    expect(data).toMatchObject({
      version: "1.0.6",
      versionCode: 7,
      apkUrl: "https://github.com/x/otopiyasa-release.apk",
      changelog: "• Yeni tasarım",
      forceUpdate: false,
    });
  });

  it("GitHub'a ulaşılamazsa varsayılan sürümü döner", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ağ yok"); }));
    const GET = await loadGet();
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.version).toBe("1.0.2");
    expect(data.versionCode).toBe(3);
    expect(data.apkUrl).toContain("otopiyasa-release.apk");
    expect(data.forceUpdate).toBe(false);
  });

  it("GitHub'a ulaşılamazsa ortam değişkenlerini kullanır", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    vi.stubEnv("APP_LATEST_VERSION", "2.0.0");
    vi.stubEnv("APP_LATEST_VERSION_CODE", "5");
    vi.stubEnv("APP_APK_URL", "https://example.com/custom.apk");
    const GET = await loadGet();
    const data = await (await GET()).json();
    expect(data.version).toBe("2.0.0");
    expect(data.versionCode).toBe(5);
    expect(data.apkUrl).toBe("https://example.com/custom.apk");
  });
});
