import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRhythKitInstallation } from "@/lib/rhythkit-api";
import { embedRhythiansId } from "@/lib/rhythkit-map-file";
import { resolveRhythKitMapSource } from "@/lib/rhythkit-map-download";

export const runtime = "nodejs";

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

export async function GET(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const { mapId: id } = await params;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; mapFileUrl: string; rating: number | null; status: string; reviewerNote: string | null; length: number | null; isAutoImported: boolean }>>(
    `SELECT "id", "title", "mapFileUrl", "rating", "status", "reviewerNote", "length", "isAutoImported" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`,
    id
  );
  const map = rows[0];
  const downloadable = map && (map.status === "approved" || map.status === "legacy" || (map.status === "pending" && map.isAutoImported));
  if (!downloadable) return NextResponse.json({ ok: false, error: "Map not found." }, { status: 404 });
  const users = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT "rhp" FROM "User" WHERE "id" = $1 LIMIT 1`, installation.userId);
  const user = users[0];
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  let source: Awaited<ReturnType<typeof resolveRhythKitMapSource>>;
  try {
    source = await resolveRhythKitMapSource(map.mapFileUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "Map file is unavailable." }, { status: 404 });
  }

  let response: Response;
  try {
    response = await fetch(source.url, { cache: "no-store", redirect: "follow" });
  } catch {
    return NextResponse.json({ ok: false, error: "Map file is unavailable." }, { status: 502 });
  }
  if (!response.ok) return NextResponse.json({ ok: false, error: `Map file is unavailable (${response.status}).` }, { status: 404 });

  const original = new Uint8Array(await response.arrayBuffer());
  let data: Uint8Array;
  try {
    data = embedRhythiansId(original, source.extension, map.id);
  } catch {
    // Any member can download any map; if the Rhythians id can't be embedded
    // (unknown format, legacy archive file), serve the original file instead
    // of rejecting the download. RHP eligibility is decided when scores are
    // submitted, not here.
    data = original;
  }

  const body = new ArrayBuffer(data.byteLength);
  new Uint8Array(body).set(data);
  return new NextResponse(new Blob([body], { type: "application/octet-stream" }), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="rhythians-${map.id}-${safeFileName(map.title)}.sspm"`,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, no-store",
      "X-Rhythians-Map-Id": map.id,
    },
  });
}
