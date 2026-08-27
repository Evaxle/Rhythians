import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRhythKitInstallation } from "@/lib/rhythkit-api";
import { embedRhythiansId, extensionFromMapUrl } from "@/lib/rhythkit-map-file";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const bucket = () => process.env.STORAGE_BUCKET ?? "media";

function fileNameFromUrl(url: string) {
  try {
    const raw = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "map.sspm");
    return raw.replace(/^[0-9a-f-]{36}-/i, "") || "map.sspm";
  } catch {
    return url.split("/").pop() || "map.sspm";
  }
}

function extensionFromPath(path: string) {
  const extension = path.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  return extension === "rhm" ? ".rhm" : ".sspm";
}

async function resolveMapSource(value: string) {
  if (/^https?:\/\//i.test(value)) return { url: value, extension: extensionFromMapUrl(value), originalName: fileNameFromUrl(value) };
  if (!supabaseAdmin) throw new Error("Storage service is not configured.");
  const { data, error } = await supabaseAdmin.storage.from(bucket()).createSignedUrl(value, 300);
  if (error || !data?.signedUrl) throw new Error("Map file is unavailable.");
  return { url: data.signedUrl, extension: extensionFromPath(value), originalName: fileNameFromUrl(value) };
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

export async function GET(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const { mapId } = await params;
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, mapFileUrl: true, status: true, title: true } });
  if (!map || (map.status !== "approved" && map.status !== "legacy")) return NextResponse.json({ ok: false, error: "Map not found." }, { status: 404 });
  let source: Awaited<ReturnType<typeof resolveMapSource>>;
  try {
    source = await resolveMapSource(map.mapFileUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "Map file is unavailable." }, { status: 404 });
  }
  const response = await fetch(source.url, { cache: "no-store", redirect: "follow" });
  if (!response.ok) return NextResponse.json({ ok: false, error: `Map file is unavailable (${response.status}).` }, { status: 404 });
  const original = new Uint8Array(await response.arrayBuffer());
  let data: Uint8Array;
  try {
    data = embedRhythiansId(original, source.extension, map.id);
  } catch {
    return NextResponse.json({ ok: false, error: "The map file could not be converted into a Rhythians SSPM." }, { status: 422 });
  }
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return new NextResponse(new Blob([buffer], { type: "application/octet-stream" }), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="rhythians-${map.id}-${safeFileName(map.title)}.sspm"`,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, no-store",
      "X-Rhythians-Map-Id": map.id,
      "X-Rhythians-Original-File": source.originalName,
    },
  });
}
