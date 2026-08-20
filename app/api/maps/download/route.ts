import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { embedRhythiansId, extensionFromMapUrl } from "@/lib/rhythkit-map-file";

export const runtime = "nodejs";

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

function fileNameFromUrl(url: string) {
  try {
    const raw = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "map.sspm");
    return raw.replace(/^[0-9a-f-]{36}-/i, "") || "map.sspm";
  } catch {
    return "map.sspm";
  }
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Map id is required." }, { status: 400 });

  const map = await prisma.challengeMap.findUnique({ where: { id }, select: { mapFileUrl: true, status: true, title: true, isAutoImported: true } });
  if (!map || map.isAutoImported || map.status !== "approved") return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const response = await fetch(map.mapFileUrl, { cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Map file is unavailable." }, { status: 404 });
  const original = new Uint8Array(await response.arrayBuffer());
  const extension = extensionFromMapUrl(map.mapFileUrl);
  let data = Buffer.from(original);
  try {
    data = Buffer.from(embedRhythiansId(original, extension, id));
  } catch {
    return NextResponse.json({ error: "The uploaded map file could not be processed safely." }, { status: 422 });
  }

  const originalName = fileNameFromUrl(map.mapFileUrl);
  const name = extension === ".sspm" ? `rhythians-${id}-${safeFileName(map.title)}.sspm` : `${safeFileName(map.title)}.rhm`;
  return new NextResponse(data, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, no-store",
      "X-Rhythians-Map-Id": id,
      "X-Rhythians-Original-File": originalName,
    },
  });
}
