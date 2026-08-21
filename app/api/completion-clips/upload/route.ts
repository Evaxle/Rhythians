import { NextResponse } from "next/server";
import { supabaseAdmin, getStoragePath } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

const VALID_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Storage service not configured." }, { status: 500 });
  const body = await request.json().catch(() => null) as { fileName?: string; contentType?: string } | null;
  if (!body?.fileName || !body.contentType || !VALID_VIDEO_TYPES.includes(body.contentType)) return NextResponse.json({ error: "Upload an MP4, WebM, or MOV video." }, { status: 400 });
  const safeName = `${user.id}/${crypto.randomUUID()}-${body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const path = getStoragePath(process.env.STORAGE_BUCKET ?? "media", "completion-clips", safeName);
  const { data, error } = await supabaseAdmin.storage.from(process.env.STORAGE_BUCKET ?? "media").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create upload URL." }, { status: 500 });
  return NextResponse.json({ uploadUrl: data.signedUrl, path });
}
