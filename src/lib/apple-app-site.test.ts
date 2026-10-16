import { describe, expect, it } from "vitest";
import { appleAppSiteAssociation } from "./apple-app-site";

describe("appleAppSiteAssociation", () => {
  it("uygulama kimliği yoksa dosya yayınlanmaz", () => {
    expect(appleAppSiteAssociation(undefined)).toBeNull();
    expect(appleAppSiteAssociation("   ")).toBeNull();
  });

  it("kimlik varsa yalnızca Google dönüş yolunu kapsar", () => {
    const body = appleAppSiteAssociation(" ABCDE12345.com.otopiyasa.otopiyasa ");
    expect(body).toEqual({
      applinks: {
        apps: [],
        details: [{ appID: "ABCDE12345.com.otopiyasa.otopiyasa", paths: ["/mobil-giris*"] }],
      },
    });
  });
});
