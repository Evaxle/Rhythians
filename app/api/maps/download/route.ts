import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { embedRhythiansId, extensionFromMapUrl } from "@/lib/rhythkit-map-file";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const bucket = () => process.env.STORAGE_BUCKET ?? "media";

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

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

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Map id is required." }, { status: 400 });

  const map = await prisma.challengeMap.findUnique({ where: { id }, select: { mapFileUrl: true, status: true, title: true } });
  if (!map || map.status !== "approved") return NextResponse.json({ error: "Map not found." }, { status: 404 });

  let source: Awaited<ReturnType<typeof resolveMapSource>>;
  try {
    source = await resolveMapSource(map.mapFileUrl);
  } catch {
    return NextResponse.json({ error: "Map file is unavailable." }, { status: 404 });
  }

  const response = await fetch(source.url, { cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Map file is unavailable." }, { status: 404 });
  const original = new Uint8Array(await response.arrayBuffer());

  let data: Uint8Array;
  try {
    data = embedRhythiansId(original, source.extension, id);
  } catch {
    return NextResponse.json({ error: "The map file could not be converted into a Rhythians SSPM." }, { status: 422 });
  }

  const name = `rhythians-${id}-${safeFileName(map.title)}.sspm`;
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, no-store",
      "X-Rhythians-Map-Id": id,
      "X-Rhythians-Original-File": source.originalName,
    },
  });
}
