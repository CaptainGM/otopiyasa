import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { ArabamCatalog, type ArabamCatalogDoc } from "@/models/ArabamCatalog";
import { normalizeBrand } from "@/lib/normalize-brand";
import { buildRareBoard, pageOfBoard, type BoardRow } from "@/lib/rare-model-board";

export const dynamic = "force-dynamic";

// Tüm aile listesi her sayfa isteğinde yeniden hesaplanmasın (aktif ilanları gruplar): 5 dakika bellekte tutulur.
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; rows: BoardRow[] } | null = null;

async function loadBoard(force: boolean): Promise<BoardRow[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;

  const [groups, catalogDocs] = await Promise.all([
    Car.aggregate<{ _id: { brand: string; model: string }; count: number }>([
      { $match: { status: "active" } },
      { $group: { _id: { brand: "$brand", model: "$model" }, count: { $sum: 1 } } },
    ]).hint({ status: 1, brand: 1, model: 1, year: 1 }),
    ArabamCatalog.find().lean<ArabamCatalogDoc[]>(),
  ]);

  const catalog = catalogDocs.flatMap((doc) =>
    doc.models.map((m) => ({ brand: normalizeBrand(doc.brand), model: m.name, sourceCount: m.count || 0 }))
  );
  const rows = buildRareBoard(
    groups.map((g) => ({ brand: g._id?.brand || "", model: g._id?.model || "", count: g.count })),
    catalog
  );
  cache = { at: Date.now(), rows };
  return rows;
}

/** Yönetim paneli sol sütunu: aktif ilan sayısı en az olan marka/modeller, sayfa başına 15. */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Bu panel yalnızca yöneticiler içindir." }, { status: 401 });
    await connectDB();
    const params = new URL(request.url).searchParams;
    const rows = await loadBoard(params.get("force") === "1");
    return NextResponse.json(
      { ...pageOfBoard(rows, Number(params.get("page") || 1)), updatedAt: new Date(cache?.at ?? Date.now()).toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("rare-models API hatası:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Liste alınamadı" }, { status: 500 });
  }
}
