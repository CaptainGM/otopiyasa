import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { ArabamCatalog, type ArabamCatalogDoc } from "@/models/ArabamCatalog";
import { RareModelAttempt } from "@/models/RareModelAttempt";
import { normalizeBrand } from "@/lib/normalize-brand";
import { buildRareBoard, onlyMissing, pageOfBoard, withAttemptNotes, type BoardAttempt, type NotedBoardRow } from "@/lib/rare-model-board";

export const dynamic = "force-dynamic";

// Tüm aile listesi her sayfa isteğinde yeniden hesaplanmasın (aktif ilanları gruplar): 5 dakika bellekte tutulur.
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; rows: NotedBoardRow[]; catalogAt: number | null } | null = null;

async function loadBoard(force: boolean) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache;

  const [groups, catalogDocs, attempts] = await Promise.all([
    Car.aggregate<{ _id: { brand: string; model: string }; count: number }>([
      { $match: { status: "active" } },
      { $group: { _id: { brand: "$brand", model: "$model" }, count: { $sum: 1 } } },
    ]).hint({ status: 1, brand: 1, model: 1, year: 1 }),
    ArabamCatalog.find().lean<ArabamCatalogDoc[]>(),
    RareModelAttempt.find({}, { brand: 1, familyKey: 1, attemptedAt: 1, retryAfterDays: 1, reason: 1, added: 1, before: 1, after: 1 }).lean<BoardAttempt[]>(),
  ]);

  const catalog = catalogDocs.flatMap((doc) =>
    doc.models.map((m) => ({ brand: normalizeBrand(doc.brand), model: m.name, sourceCount: m.count || 0 }))
  );
  const rows = withAttemptNotes(
    buildRareBoard(
      groups.map((g) => ({ brand: g._id?.brand || "", model: g._id?.model || "", count: g.count })),
      catalog
    ),
    attempts
  );
  const catalogAt = catalogDocs.length ? Math.max(...catalogDocs.map((d) => new Date(d.fetchedAt).getTime())) : null;
  cache = { at: Date.now(), rows, catalogAt };
  return cache;
}

/**
 * Yönetim paneli sol sütunu: aktif ilan sayısı en az olan marka/modeller, sayfa başına 15.
 * `scope=missing` (varsayılan): kaynaktakinden az ilanı olanlar; `scope=all`: kaynağı bilinmeyenler ve tamamı bizde olanlar da.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Bu panel yalnızca yöneticiler içindir." }, { status: 401 });
    await connectDB();
    const params = new URL(request.url).searchParams;
    const board = await loadBoard(params.get("force") === "1");
    const missing = onlyMissing(board.rows);
    const scope = params.get("scope") === "all" ? "all" : "missing";
    return NextResponse.json(
      {
        ...pageOfBoard(scope === "all" ? board.rows : missing, Number(params.get("page") || 1)),
        scope,
        counts: { missing: missing.length, all: board.rows.length },
        updatedAt: new Date(board.at).toISOString(),
        catalogAt: board.catalogAt ? new Date(board.catalogAt).toISOString() : null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("rare-models API hatası:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Liste alınamadı" }, { status: 500 });
  }
}
