import { NextResponse } from "next/server";
import { getNavbarUser } from "@/lib/auth";

export async function GET() {
  const user = await getNavbarUser();
  const response = NextResponse.json({
    user: user ? { name: user.name, role: user.role } : null,
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  return response;
}
