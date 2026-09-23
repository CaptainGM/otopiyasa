import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

describe("GET /api/app-version", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default version info when no env vars are set", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.version).toBe("1.0.2");
    expect(data.versionCode).toBe(3);
    expect(data.apkUrl).toContain("otopiyasa-release.apk");
    expect(data.changelog).toBeTruthy();
    expect(data.forceUpdate).toBe(false);
  });

  it("honors environment variables if specified", async () => {
    vi.stubEnv("APP_LATEST_VERSION", "2.0.0");
    vi.stubEnv("APP_LATEST_VERSION_CODE", "5");
    vi.stubEnv("APP_APK_URL", "https://example.com/custom.apk");

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.version).toBe("2.0.0");
    expect(data.versionCode).toBe(5);
    expect(data.apkUrl).toBe("https://example.com/custom.apk");
  });
});
