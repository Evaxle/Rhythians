import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { supabaseAdmin, getStoragePath } from "@/lib/supabase";

const VALID_MAP_EXTENSIONS = ["sspm", "rhm"];
const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia account to submit maps." }, { status: 403 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Storage service not configured" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const { fileName, contentType, folder, fileSize } = body as { fileName?: string; contentType?: string; folder?: string; fileSize?: number };
  if (!fileName || !folder || !contentType) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (folder === "maps") {
    if (!VALID_MAP_EXTENSIONS.includes(extension)) return NextResponse.json({ error: "Map file must be .rhm or .sspm." }, { status: 400 });
    if (fileSize && fileSize > 50 * 1024 * 1024) return NextResponse.json({ error: "Map file must be 50 MB or smaller." }, { status: 400 });
  } else if (folder === "map-images") {
    if (!VALID_IMAGE_TYPES.includes(contentType)) return NextResponse.json({ error: "Image must be PNG, JPG, JPEG, or WEBP." }, { status: 400 });
  } else {
    return NextResponse.json({ error: "Invalid upload folder." }, { status: 400 });
  }

  const path = getStoragePath(process.env.STORAGE_BUCKET ?? "media", folder, fileName);
  try {
    const { data, error } = await supabaseAdmin.storage.from(process.env.STORAGE_BUCKET ?? "media").createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create upload url" }, { status: 500 });
    return NextResponse.json({ uploadUrl: data.signedUrl, path });
  } catch {
    return NextResponse.json({ error: "Upload service error" }, { status: 500 });
  }
}
