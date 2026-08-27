import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRankIndex } from "@/lib/rhythkit";
import { getRhythKitInstallation, isMapAllowed, isRankedMap } from "@/lib/rhythkit-api";
import { embedRhythiansId } from "@/lib/rhythkit-map-file";
import { resolveRhythKitMapSource } from "@/lib/rhythkit-map-download";

export const runtime = "nodejs";

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; mapFileUrl: string; rating: number | null; status: string; reviewerNote: string | null; length: number | null }>>(
    `SELECT "id", "title", "mapFileUrl", "rating", "status", "reviewerNote", "length" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`,
    id
  );
  const map = rows[0];
  if (!map || (map.status !== "approved" && map.status !== "legacy")) return NextResponse.json({ ok: false, error: "Map not found." }, { status: 404 });
  const users = await prisma.$queryRawUnsafe<Array<{ rhp: number }>>(`SELECT "rhp" FROM "User" WHERE "id" = $1 LIMIT 1`, installation.userId);
  const user = users[0];
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  if (!isMapAllowed(map.rating, map.reviewerNote, map.status, getRankIndex(user.rhp))) return NextResponse.json({ ok: false, error: "Map is outside your current rank range." }, { status: 403 });
  if (isRankedMap(map.rating, map.reviewerNote, map.status) && (map.rating == null || map.rating < 0 || map.rating > 9.99)) return NextResponse.json({ ok: false, error: "Map rating is invalid." }, { status: 422 });

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

  let data: Uint8Array;
  try {
    data = embedRhythiansId(new Uint8Array(await response.arrayBuffer()), source.extension, map.id);
  } catch {
    return NextResponse.json({ ok: false, error: "The map file is not a valid Rhythia map." }, { status: 422 });
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
