import { afterEach, describe, expect, it, vi } from "vitest";

const runHealthCheck = vi.fn(async () => ({ issues: [] as Array<{ key: string }>, notified: 0, resolved: 0 }));

vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn(async () => undefined) }));
vi.mock("@/lib/health-check", () => ({ runHealthCheck: () => runHealthCheck() }));

const { GET } = await import("@/app/api/cron/health/route");

function request(headers: Record<string, string> = {}) {
  return new Request("https://otopiyasa.app/api/cron/health", { headers });
}

const originalCronSecret = process.env.CRON_SECRET;
const originalScrapeSecret = process.env.SCRAPE_RUN_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalScrapeSecret === undefined) delete process.env.SCRAPE_RUN_SECRET;
  else process.env.SCRAPE_RUN_SECRET = originalScrapeSecret;
  runHealthCheck.mockClear();
});

describe("GET /api/cron/health", () => {
  it("CRON_SECRET yokken sahte vercel-cron User-Agent'ı kabul etmez", async () => {
    // Bu başlık istemci tarafından yazılabildiği için yetki kaynağı olamaz.
    delete process.env.CRON_SECRET;
    delete process.env.SCRAPE_RUN_SECRET;

    const response = await GET(request({ "user-agent": "vercel-cron/1.0" }));
    expect(response.status).toBe(401);
    expect(runHealthCheck).not.toHaveBeenCalled();
  });

  it("hiçbir sır tanımlı değilken tamamen kapalıdır (fail-closed)", async () => {
    delete process.env.CRON_SECRET;
    delete process.env.SCRAPE_RUN_SECRET;

    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(runHealthCheck).not.toHaveBeenCalled();
  });

  it("CRON_SECRET tanımlıysa yalnızca doğru Bearer başlığını kabul eder", async () => {
    process.env.CRON_SECRET = "test-cron-secret";

    expect((await GET(request({ authorization: "Bearer yanlis" }))).status).toBe(401);
    expect((await GET(request({ "user-agent": "vercel-cron/1.0" }))).status).toBe(401);
    expect(runHealthCheck).not.toHaveBeenCalled();

    const response = await GET(request({ authorization: "Bearer test-cron-secret" }));
    expect(response.status).toBe(200);
    expect(runHealthCheck).toHaveBeenCalledTimes(1);
  });

  it("motor x-scrape-secret ile çağırabilir", async () => {
    delete process.env.CRON_SECRET;
    process.env.SCRAPE_RUN_SECRET = "test-scrape-secret";

    expect((await GET(request({ "x-scrape-secret": "yanlis" }))).status).toBe(401);

    const response = await GET(request({ "x-scrape-secret": "test-scrape-secret" }));
    expect(response.status).toBe(200);
    expect(runHealthCheck).toHaveBeenCalledTimes(1);
  });
});
