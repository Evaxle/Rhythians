import { NextResponse } from "next/server";
import { supabaseAdmin, getStoragePath } from "@/lib/supabase";

const VALID_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Storage service not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { fileName, contentType, folder } = body as { fileName: string; contentType: string; folder: string; fileSize?: number };

  if (!fileName || !contentType || !folder) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  if (folder === "clips") {
    if (!VALID_VIDEO_TYPES.includes(contentType)) {
      return NextResponse.json({ error: "Invalid video file type." }, { status: 400 });
    }
  } else if (folder === "thumbnails") {
    if (!VALID_IMAGE_TYPES.includes(contentType)) {
      return NextResponse.json({ error: "Invalid thumbnail file type." }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Invalid upload folder." }, { status: 400 });
  }

  const path = getStoragePath(process.env.STORAGE_BUCKET ?? "media", folder, fileName);
  
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(process.env.STORAGE_BUCKET ?? "media")
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Could not create upload url" }, { status: 500 });
    }

    return NextResponse.json({ uploadUrl: data.signedUrl, path });
  } catch (err) {
    return NextResponse.json({ error: "Upload service error" }, { status: 500 });
  }
}
