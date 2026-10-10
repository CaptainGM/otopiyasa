import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/.well-known/assetlinks.json/route";

const workflowPath = path.join(process.cwd(), ".github", "workflows", "mobile-release.yml");

/** apksigner parmak izini "AA:BB:..." biçimine çevirir (iki nokta üst üste olmadan da kabul eder). */
function toColonFingerprint(raw: string): string {
  return raw
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase()
    .replace(/(..)(?=.)/g, "$1:");
}

async function publishedFingerprints(): Promise<string[]> {
  const response = await GET();
  const body = (await response.json()) as Array<{
    target: { sha256_cert_fingerprints: string[] };
  }>;
  return body.flatMap((entry) => entry.target.sha256_cert_fingerprints);
}

describe("assetlinks.json", () => {
  it("yayınlanan APK'nın imza parmak izini içerir", async () => {
    // Yayın iş akışı APK'yı bu parmak izine karşı doğruluyor; assetlinks bunu içermezse
    // https bağlantıları uygulamada açılmaz (sessiz arıza).
    const workflow = readFileSync(workflowPath, "utf8");
    const expected = /EXPECTED_CERT_SHA256:\s*([0-9a-fA-F]{64})/.exec(workflow)?.[1];
    expect(expected, "mobile-release.yml içinde EXPECTED_CERT_SHA256 bulunamadı").toBeTruthy();

    const fingerprints = await publishedFingerprints();
    expect(fingerprints).toContain(toColonFingerprint(expected!));
  });

  it("paket adı ve ilişki türü Android'in beklediği biçimde", async () => {
    const response = await GET();
    const body = (await response.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].relation).toEqual(["delegate_permission/common.handle_all_urls"]);
    expect((body[0].target as Record<string, unknown>).namespace).toBe("android_app");
    expect((body[0].target as Record<string, unknown>).package_name).toBe("com.otopiyasa.otopiyasa");
  });

  it("tüm parmak izleri 32 baytlık büyük harfli SHA-256 biçiminde", async () => {
    const fingerprints = await publishedFingerprints();
    expect(fingerprints.length).toBeGreaterThan(0);
    for (const fingerprint of fingerprints) {
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });
});
