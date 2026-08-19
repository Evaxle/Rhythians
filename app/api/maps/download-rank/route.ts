import { PassThrough, Readable } from "node:stream";
import archiver from "archiver";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getApprovedMaps } from "@/lib/maps-legacy";
import { getRankInfo } from "@/lib/ranks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/(\.[a-z0-9]{2,8})$/i);
    return match?.[1] ?? ".rhm";
  } catch {
    return ".rhm";
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const data = await getApprovedMaps(true, user.id);
  if (!data.rankInfo) return NextResponse.json({ error: "Unable to determine your rank." }, { status: 400 });

  const rankInfo = getRankInfo(user.rhp);
  const maps = data.maps.filter((map) => map.rating != null && map.rating >= rankInfo.rangeMin && map.rating <= rankInfo.rangeMax);
  if (maps.length === 0) return NextResponse.json({ error: "No maps are available for your rank." }, { status: 404 });

  const archive = archiver("zip", { zlib: { level: 6 } });
  const pass = new PassThrough();
  archive.pipe(pass);

  const failures: string[] = [];
  let index = 0;
  for (const map of maps) {
    try {
      const response = await fetch(map.mapFileUrl, { cache: "no-store" });
      if (!response.ok || !response.body) {
        failures.push(`${map.title}: HTTP ${response.status}`);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const extension = extensionFromUrl(map.mapFileUrl);
      index += 1;
      archive.append(buffer, { name: `${String(index).padStart(3, "0")} - ${safeName(map.title)}${extension}` });
    } catch (error) {
      failures.push(`${map.title}: ${error instanceof Error ? error.message : "download failed"}`);
    }
  }

  if (failures.length > 0) archive.append(`${failures.join("\n")}\n`, { name: "download-errors.txt" });
  await archive.finalize();

  return new NextResponse(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName(rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`)}-maps.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
