import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser, isOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

const bucket = () => process.env.STORAGE_BUCKET ?? "media";
const settingKey = "wiki_vibro_videos";
const kinds = ["linear", "spin", "mouse_swiveling", "cheesing"] as const;
type VibroKind = (typeof kinds)[number];
type VideoMap = Partial<Record<VibroKind, string>>;

async function readVideos(): Promise<VideoMap> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey }, select: { value: true } });
  if (!setting?.value) return {};
  try {
    const value = JSON.parse(setting.value) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as VideoMap;
  } catch {
    return {};
  }
}

export async function GET() {
  return NextResponse.json({ videos: await readVideos() });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isOwner(user)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Storage service is not configured." }, { status: 500 });
  const body = await request.json().catch(() => null) as { action?: unknown; kind?: unknown; fileName?: unknown; fileSize?: unknown; contentType?: unknown; path?: unknown; publicUrl?: unknown } | null;
  const kind = typeof body?.kind === "string" && kinds.includes(body.kind as VibroKind) ? body.kind as VibroKind : null;
  if (!kind) return NextResponse.json({ error: "Invalid Vibro type." }, { status: 400 });

  if (body?.action === "upload") {
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileSize = Number(body.fileSize);
    const contentType = typeof body.contentType === "string" ? body.contentType : "video/mp4";
    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 250 * 1024 * 1024) return NextResponse.json({ error: "Video must be between 1 byte and 250 MB." }, { status: 400 });
    if (!contentType.startsWith("video/")) return NextResponse.json({ error: "Only video files are allowed." }, { status: 400 });
    const path = `wiki/vibro/${kind}/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const upload = await supabaseAdmin.storage.from(bucket()).createSignedUploadUrl(path);
    if (upload.error || !upload.data) return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 });
    return NextResponse.json({ uploadUrl: upload.data.signedUrl, path, publicUrl: supabaseAdmin.storage.from(bucket()).getPublicUrl(path).data.publicUrl });
  }

  if (body?.action === "save") {
    const path = typeof body.path === "string" ? body.path : "";
    const publicUrl = typeof body.publicUrl === "string" ? body.publicUrl : "";
    if (!path || !publicUrl || !path.startsWith(`wiki/vibro/${kind}/`)) return NextResponse.json({ error: "Invalid uploaded video." }, { status: 400 });
    const videos = await readVideos();
    videos[kind] = publicUrl;
    await prisma.siteSetting.upsert({ where: { key: settingKey }, update: { value: JSON.stringify(videos) }, create: { key: settingKey, value: JSON.stringify(videos), description: "Owner-managed Vibro wiki videos" } });
    return NextResponse.json({ videos });
  }

  if (body?.action === "remove") {
    const videos = await readVideos();
    delete videos[kind];
    await prisma.siteSetting.upsert({ where: { key: settingKey }, update: { value: JSON.stringify(videos) }, create: { key: settingKey, value: JSON.stringify(videos), description: "Owner-managed Vibro wiki videos" } });
    return NextResponse.json({ videos });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
