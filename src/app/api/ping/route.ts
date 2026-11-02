import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Süper hafif (0ms) canlılık denetimi uç noktası.
 * Veritabanı sorgusu yapmaz, bellekte bekletmez.
 * Render ücretsiz sunucusunun 15 dakika hareketsizlikten uykuya dalmasını (soğuk açılış)
 * önlemek amacıyla periyodik keep-alive istekleri için kullanılır.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      time: Date.now(),
      uptime: Math.round(process.uptime()),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
