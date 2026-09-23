import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.otopiyasa.otopiyasa",
        sha256_cert_fingerprints: [
          // Android default debug & upload fingerprints
          "14:26:0D:37:A6:49:15:3F:89:D2:C3:FF:11:03:7E:6D:FE:B3:26:95:F4:96:A2:AE:31:01:46:1D:91:AA:A0:DF",
        ],
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
