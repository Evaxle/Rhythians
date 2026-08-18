import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS, isCategory, MAX_CATEGORY_LEVEL } from "@/lib/categories";

export const dynamic = "force-dynamic";

// Streams a zip of the approved map files for a category. If a level is
// provided, only that level's maps are included; otherwise all levels in the
// category are zipped. Map files are fetched from their external URLs and
// streamed into the archive so large maps don't blow up memory.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  if (!isCategory(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const levelParam = searchParams.get("level");
  let level: number | null = null;
  if (levelParam != null) {
    level = Number(levelParam);
    if (!Number.isInteger(level) || level < 1 || level > MAX_CATEGORY_LEVEL) {
      return NextResponse.json({ error: `Level must be between 1 and ${MAX_CATEGORY_LEVEL}.` }, { status: 400 });
    }
  }

  const maps = await prisma.categoryMap.findMany({
    where: { category, status: "approved", ...(level != null ? { level } : {}) },
    orderBy: [{ level: "asc" }, { title: "asc" }],
    select: { title: true, level: true, mapFileUrl: true },
  });

  if (maps.length === 0) {
    return NextResponse.json({ error: "No maps found in this category." }, { status: 404 });
  }

  const label = CATEGORY_LABELS[category].toLowerCase().replace(/\s+/g, "-");
  const filename = level != null ? `${label}-level-${level}.zip` : `${label}-all-levels.zip`;

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = new ReadableStream({
    start(controller) {
      archive.on("data", (chunk) => controller.enqueue(chunk));
      archive.on("end", () => controller.close());
      archive.on("warning", () => {});
      archive.on("error", (error) => controller.error(error));
    },
    cancel() {
      archive.abort();
    },
  });

  // Fetch each map file and stream it into the archive. Files that fail to
  // download are skipped so one bad URL doesn't break the whole zip.
  for (const map of maps) {
    try {
      const response = await fetch(map.mapFileUrl, { cache: "no-store" });
      if (!response.ok || !response.body) continue;
      const safeTitle = map.title.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
      const prefix = level != null ? "" : `level-${map.level}/`;
      archive.append(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), {
        name: `${prefix}${safeTitle}.map`,
      });
    } catch {
      // Skip unreachable map files.
    }
  }

  archive.finalize();

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
