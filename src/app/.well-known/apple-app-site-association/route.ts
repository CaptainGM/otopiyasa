import { NextResponse } from "next/server";
import { appleAppSiteAssociation } from "@/lib/apple-app-site";

export const dynamic = "force-dynamic";

/** iOS Universal Links doğrulaması. APPLE_APP_ID tanımlanana kadar uç kapalıdır (404). */
export function GET() {
  const body = appleAppSiteAssociation(process.env.APPLE_APP_ID);
  if (!body) return new NextResponse(null, { status: 404 });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
