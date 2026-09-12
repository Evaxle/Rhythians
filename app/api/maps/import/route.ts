import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { analyzeMapNotes, parseMapNotes } from "@/lib/map-difficulty";
import { getApprovedMaps } from "@/lib/maps-legacy";

export const runtime = "nodejs";

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in before importing maps." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an SSPM map file." }, { status: 400 });
  if (file.size <= 0 || file.size > 32 * 1024 * 1024) return NextResponse.json({ error: "Map files must be between 1 byte and 32 MB." }, { status: 400 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const notes = parseMapNotes(bytes);
    const analysis = analyzeMapNotes(notes);
    const title = file.name.replace(/\.sspm$/i, "").replace(/[_-]+/g, " ").trim() || "Imported map";
    const importedKey = normalizeTitle(title);
    const catalog = await getApprovedMaps(true, user.id, true);
    const matched = catalog.maps.find((map) => normalizeTitle(map.title) === importedKey) ?? null;

    return NextResponse.json({
      map: {
        id: matched?.id ?? null,
        title: matched?.title ?? title,
        artist: matched?.artist ?? null,
        mapperName: matched?.mapperName ?? null,
        imageUrl: matched?.imageUrl ?? null,
        mapFileUrl: matched?.mapFileUrl ?? null,
        isRanked: Boolean(matched?.isRanked),
        isLegacy: Boolean(matched?.isLegacy),
        status: matched?.isRanked ? "Ranked" : matched?.isLegacy ? "Legacy" : "Unranked",
        officialRating: matched?.rating ?? null,
      },
      analysis,
      notes,
      importedFileName: file.name,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to parse this map." }, { status: 400 });
  }
}
