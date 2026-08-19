import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { getStoragePath, supabaseAdmin } from "@/lib/supabase";

const VALID_EXTENSIONS = ["sspm", "rhm", "osu", "zip"];
const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Storage service is not configured." }, { status: 500 });

  const body = await request.json().catch(() => null) as { fileName?: unknown; contentType?: unknown; fileSize?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "application/octet-stream";
  const fileSize = Number(body?.fileSize);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (!fileName || !VALID_EXTENSIONS.includes(extension)) return NextResponse.json({ error: "Map file must be .sspm, .rhm, .osu, or .zip." }, { status: 400 });
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_SIZE) return NextResponse.json({ error: "Map file must be between 1 byte and 50 MB." }, { status: 400 });

  const bucket = process.env.STORAGE_BUCKET ?? "media";
  const path = getStoragePath(bucket, "maps", fileName);
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create upload URL." }, { status: 500 });
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;

  return NextResponse.json({ uploadUrl: data.signedUrl, path, publicUrl, contentType, fileName });
}
