import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/google-auth";

/** Uygulama ve web bu uçtan Google düğmesini gösterip gizleyeceğini öğrenir. */
export function GET() {
  return NextResponse.json(
    { enabled: isGoogleConfigured() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
