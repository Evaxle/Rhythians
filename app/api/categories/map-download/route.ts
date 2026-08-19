import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function fileNameFromUrl(url: string) {
  const raw = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "map.sspm");
  return raw.replace(/^[0-9a-f-]{36}-/i, "") || "map.sspm";
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Map id is required." }, { status: 400 });

  const map = await prisma.categoryMap.findFirst({ where: { id, submittedBy: { profileHandle: { not: "rhythia-imports" } } }, select: { mapFileUrl: true, status: true } });
  if (!map || map.status !== "approved") return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const response = await fetch(map.mapFileUrl, { cache: "no-store" });
  if (!response.ok || !response.body) return NextResponse.json({ error: "Map file is unavailable." }, { status: 404 });

  return new NextResponse(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileNameFromUrl(map.mapFileUrl).replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
