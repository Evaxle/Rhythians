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
    for (const marker of [`/storage/v1/object/public/${bucket()}/`, `/storage/v1/object/sign/${bucket()}/`, `/storage/v1/object/authenticated/${bucket()}/`]) {
      const index = url.pathname.indexOf(marker);
      if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
    }
  } catch {}
  return null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rows = await prisma.$queryRawUnsafe<Array<{ videoUrl: string }>>('SELECT "videoUrl" FROM "SettingsShowcase" WHERE "id"=$1 LIMIT 1', id);
  const value = rows[0]?.videoUrl;
  if (!value) return new NextResponse("Video not found.", { status: 404 });
  const path = storagePath(value);
  if (!path) {
    if (/^https?:\/\//i.test(value)) return NextResponse.redirect(value, 307);
    return new NextResponse("Video path is invalid.", { status: 404 });
  }
  if (!supabaseAdmin) return new NextResponse("Storage unavailable.", { status: 503 });
  const { data, error } = await supabaseAdmin.storage.from(bucket()).createSignedUrl(path, 6 * 60 * 60);
  if (error || !data?.signedUrl) return new NextResponse("Video unavailable.", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 307, headers: { "Cache-Control": "private, max-age=300" } });
}
