import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const AVATAR_BUCKET = "avatars";

function extFromType(type: string) {
  if (type === "image/jpeg") return "jpg";
  return type.split("/")[1] ?? "png";
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "avatar_upload", 20, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Storage is not configured" }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Please upload a PNG, JPEG, WebP, or GIF image." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const path = `${AVATAR_BUCKET}/${user.id}-${Date.now()}.${extFromType(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    await supabaseAdmin.storage
      .createBucket(AVATAR_BUCKET, { public: true, fileSizeLimit: MAX_SIZE })
      .catch(() => {});
    const retry = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
    if (retry.error) {
      return NextResponse.json({ error: "Could not upload your image." }, { status: 500 });
    }
  }

  const { data } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  await prisma.user.update({
    where: { id: user.id },
    data: { avatar: publicUrl },
  });

  return NextResponse.json({ url: publicUrl });
}
