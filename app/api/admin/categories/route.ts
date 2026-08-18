import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { isCategory, MAX_CATEGORY_LEVEL } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const category = body?.category;
  const level = Number(body?.level);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() : null;
  const mapFileUrl = typeof body?.mapFileUrl === "string" ? body.mapFileUrl.trim() : "";
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : null;
  const mapperName = typeof body?.mapperName === "string" ? body.mapperName.trim() : null;
  const noteCount = body?.noteCount != null ? Number(body.noteCount) : null;
  const length = body?.length != null ? Number(body.length) : null;
  const sourceBeatmapId = body?.sourceBeatmapId != null ? Number(body.sourceBeatmapId) : null;
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : null;

  if (typeof category !== "string" || !isCategory(category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  if (!Number.isInteger(level) || level < 1 || level > MAX_CATEGORY_LEVEL) {
    return NextResponse.json({ error: `Level must be between 1 and ${MAX_CATEGORY_LEVEL}.` }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!mapFileUrl) return NextResponse.json({ error: "Map file URL is required." }, { status: 400 });

  try {
    // Category maps are curated manually by admins, so they go live immediately
    // (no pending review step) with the admin as both submitter and reviewer.
    const map = await prisma.categoryMap.create({
      data: {
        category,
        level,
        title,
        artist,
        mapFileUrl,
        imageUrl,
        mapperName,
        noteCount: noteCount != null && Number.isFinite(noteCount) ? Math.round(noteCount) : null,
        length: length != null && Number.isFinite(length) ? Math.round(length) : null,
        sourceBeatmapId: sourceBeatmapId != null && Number.isFinite(sourceBeatmapId) ? Math.round(sourceBeatmapId) : null,
        sourceUrl,
        submittedById: admin.id,
        status: "approved",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({ map }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "A map with that source beatmap id already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create the category map." }, { status: 400 });
  }
}
