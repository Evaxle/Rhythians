import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { identifyExternalClipSource, validateExternalClipUrl } from "@/lib/clip-source";

export const runtime = "nodejs";
const bucket = () => process.env.STORAGE_BUCKET ?? "media";
const MAX_SETTINGS_SIZE = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;

async function ownEntry(userId: string, id: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string; settingsFileUrl: string; settingsFileName: string; videoUrl: string }>>(`SELECT "id","userId","settingsFileUrl","settingsFileName","videoUrl" FROM "SettingsShowcase" WHERE "id"=$1 AND "userId"=$2 LIMIT 1`, id, userId);
  return rows[0] ?? null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Storage service is not configured." }, { status: 500 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || !(await ownEntry(user.id, id))) return NextResponse.json({ error: "Settings entry not found." }, { status: 404 });

  if (body?.action === "upload") {
    const result: Record<string, string> = {};
    const settingsFileName = typeof body.settingsFileName === "string" ? body.settingsFileName.trim() : "";
    const settingsFileSize = Number(body.settingsFileSize ?? 0);
    if (settingsFileName) {
      if (!/\.rhs$/i.test(settingsFileName)) return NextResponse.json({ error: "Settings file must be an .rhs file." }, { status: 400 });
      if (!Number.isFinite(settingsFileSize) || settingsFileSize <= 0 || settingsFileSize > MAX_SETTINGS_SIZE) return NextResponse.json({ error: "Settings file must be between 1 byte and 25 MB." }, { status: 400 });
      const path = `settings/${randomUUID()}/${settingsFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const upload = await supabaseAdmin.storage.from(bucket()).createSignedUploadUrl(path);
      if (upload.error || !upload.data) return NextResponse.json({ error: "Could not prepare the settings upload." }, { status: 500 });
      result.settingsUploadUrl = upload.data.signedUrl;
      result.settingsPath = path;
    }
    const videoFileName = typeof body.videoFileName === "string" ? body.videoFileName.trim() : "";
    const videoFileSize = Number(body.videoFileSize ?? 0);
    if (videoFileName) {
      if (!/\.(mp4|webm|mov|m4v)$/i.test(videoFileName)) return NextResponse.json({ error: "Gameplay preview must be MP4, WebM, MOV, or M4V." }, { status: 400 });
      if (!Number.isFinite(videoFileSize) || videoFileSize <= 0 || videoFileSize > MAX_VIDEO_SIZE) return NextResponse.json({ error: "Video must be between 1 byte and 250 MB." }, { status: 400 });
      const path = `settings/${randomUUID()}/${videoFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const upload = await supabaseAdmin.storage.from(bucket()).createSignedUploadUrl(path);
      if (upload.error || !upload.data) return NextResponse.json({ error: "Could not prepare the video upload." }, { status: 500 });
      result.videoUploadUrl = upload.data.signedUrl;
      result.videoPath = path;
    }
    return NextResponse.json(result);
  }

  if (body?.action === "update") {
    const current = await ownEntry(user.id, id);
    if (!current) return NextResponse.json({ error: "Settings entry not found." }, { status: 404 });
    const settingsPath = typeof body.settingsPath === "string" ? body.settingsPath : "";
    const settingsFileName = typeof body.settingsFileName === "string" ? body.settingsFileName : "";
    const videoPath = typeof body.videoPath === "string" ? body.videoPath : "";
    const externalVideoUrl = typeof body.externalVideoUrl === "string" ? body.externalVideoUrl.trim() : "";
    let videoValue = videoPath || current.videoUrl;
    if (externalVideoUrl) {
      const source = identifyExternalClipSource(externalVideoUrl);
      if (!source) return NextResponse.json({ error: "Use a valid TikTok, YouTube, Twitch, or Medal.tv video URL." }, { status: 400 });
      videoValue = validateExternalClipUrl(source, externalVideoUrl).url;
    }
    const settingsValue = settingsPath || current.settingsFileUrl;
    const fileName = settingsFileName || current.settingsFileName;
    await prisma.$executeRawUnsafe(`UPDATE "SettingsShowcase" SET "settingsFileUrl"=$1,"settingsFileName"=$2,"videoUrl"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$4 AND "userId"=$5`, settingsValue, fileName, videoValue, id, user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
