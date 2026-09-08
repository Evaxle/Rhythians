import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucket = () => process.env.STORAGE_BUCKET ?? "media";

function storagePath(value: string) {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const url = new URL(value);
    const markers = [
      `/storage/v1/object/public/${bucket()}/`,
      `/storage/v1/object/sign/${bucket()}/`,
      `/storage/v1/object/authenticated/${bucket()}/`,
    ];
    for (const marker of markers) {
      const index = url.pathname.indexOf(marker);
      if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
    }
  } catch {}
  return null;
}

function safeFileName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim();
  return cleaned || "settings.rhs";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await prisma.$queryRawUnsafe<Array<{ settingsFileUrl: string; settingsFileName: string }>>(
    `SELECT "settingsFileUrl","settingsFileName" FROM "SettingsShowcase" WHERE "id"=$1 LIMIT 1`,
    id
  );
  const entry = rows[0];
  if (!entry) return NextResponse.json({ error: "Settings entry not found." }, { status: 404 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Storage service is not configured." }, { status: 500 });

  const path = storagePath(entry.settingsFileUrl);
  if (!path) return NextResponse.json({ error: "Settings file path is invalid." }, { status: 404 });

  const { data, error } = await supabaseAdmin.storage.from(bucket()).download(path);
  if (error || !data) return NextResponse.json({ error: "Settings file could not be downloaded." }, { status: 404 });

  const bytes = await data.arrayBuffer();
  const fileName = safeFileName(entry.settingsFileName);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
