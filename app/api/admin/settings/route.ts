import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { identifyExternalClipSource, validateExternalClipUrl } from "@/lib/clip-source";

const bucket = () => process.env.STORAGE_BUCKET ?? "media";
const MAX_SETTINGS_SIZE = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;

async function authorize() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!(await canAccessAdmin(user))) return { response: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; cameraMode: string; userId: string; settingsFileUrl: string; settingsFileName: string; videoUrl: string; title: string | null; description: string | null; username: string; displayName: string | null; profileHandle: string; globalRank: number | null; profileUrl: string | null; profileUsername: string | null }>>(`SELECT s."id",s."cameraMode",s."userId",s."settingsFileUrl",s."settingsFileName",s."videoUrl",s."title",s."description",u."username",u."displayName",u."profileHandle",rp."globalRank",rp."profileUrl",rp."username" AS "profileUsername" FROM "SettingsShowcase" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u."id" ORDER BY s."cameraMode",COALESCE(rp."globalRank",2147483647),s."createdAt" ASC`);
  return NextResponse.json({ settings: rows });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  if (!supabaseAdmin) return NextResponse.json({ error: "Storage service is not configured." }, { status: 500 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  if (body?.action === "upload") {
    const result: Record<string, string> = {};
    const settingsFileName = typeof body.settingsFileName === "string" ? body.settingsFileName.trim() : "";
    const settingsFileSize = Number(body.settingsFileSize ?? 0);
    if (settingsFileName) {
      if (!/\.rhs$/i.test(settingsFileName)) return NextResponse.json({ error: "Settings file must be an .rhs file." }, { status: 400 });
      if (!Number.isFinite(settingsFileSize) || settingsFileSize <= 0 || settingsFileSize > MAX_SETTINGS_SIZE) return NextResponse.json({ error: "Settings file must be between 1 byte and 25 MB." }, { status: 400 });
      const path = `settings/${randomUUID()}/${settingsFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const upload = await supabaseAdmin.storage.from(bucket()).createSignedUploadUrl(path);
      if (upload.error || !upload.data) return NextResponse.json({ error: "Could not create the settings upload URL." }, { status: 500 });
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
      if (upload.error || !upload.data) return NextResponse.json({ error: "Could not create the video upload URL." }, { status: 500 });
      result.videoUploadUrl = upload.data.signedUrl;
      result.videoPath = path;
    }
    return NextResponse.json(result);
  }

  if (body?.action === "create" || body?.action === "update") {
    const id = typeof body.id === "string" ? body.id : "";
    const cameraMode = body.cameraMode === "spin" ? "spin" : body.cameraMode === "lock" ? "lock" : "";
    const userId = typeof body.userId === "string" ? body.userId : "";
    const settingsPath = typeof body.settingsPath === "string" ? body.settingsPath : "";
    const videoPath = typeof body.videoPath === "string" ? body.videoPath : "";
    const externalVideoUrl = typeof body.externalVideoUrl === "string" ? body.externalVideoUrl.trim() : "";
    const settingsFileName = typeof body.settingsFileName === "string" ? body.settingsFileName : "";
    const title = typeof body.title === "string" ? body.title.trim() || null : null;
    const description = typeof body.description === "string" ? body.description.trim() || null : null;
    if (!cameraMode || !userId) return NextResponse.json({ error: "Camera mode and connected user are required." }, { status: 400 });
    const linked = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { userId: true } });
    if (!linked) return NextResponse.json({ error: "The selected user does not have a connected Rhythia account." }, { status: 400 });
    let externalValue = "";
    if (externalVideoUrl) {
      const source = identifyExternalClipSource(externalVideoUrl);
      if (!source) return NextResponse.json({ error: "Use a valid TikTok, YouTube, Twitch, or Medal.tv video URL." }, { status: 400 });
      externalValue = validateExternalClipUrl(source, externalVideoUrl).url;
    }

    if (body.action === "update") {
      if (!id) return NextResponse.json({ error: "Settings entry is required." }, { status: 400 });
      const current = await prisma.$queryRawUnsafe<Array<{ settingsFileUrl: string; settingsFileName: string; videoUrl: string }>>(`SELECT "settingsFileUrl","settingsFileName","videoUrl" FROM "SettingsShowcase" WHERE "id"=$1 LIMIT 1`, id);
      if (!current[0]) return NextResponse.json({ error: "Settings entry not found." }, { status: 404 });
      await prisma.$executeRawUnsafe(`UPDATE "SettingsShowcase" SET "cameraMode"=$1,"userId"=$2,"settingsFileUrl"=$3,"settingsFileName"=$4,"videoUrl"=$5,"title"=$6,"description"=$7,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$8`, cameraMode, userId, settingsPath || current[0].settingsFileUrl, settingsFileName || current[0].settingsFileName, externalValue || videoPath || current[0].videoUrl, title, description, id);
      return NextResponse.json({ id });
    }

    if (!settingsPath || !settingsFileName || (!videoPath && !externalValue)) return NextResponse.json({ error: "A settings file and either a gameplay video file or supported video URL are required." }, { status: 400 });
    const newId = randomUUID();
    await prisma.$executeRawUnsafe(`INSERT INTO "SettingsShowcase" ("id","cameraMode","userId","settingsFileUrl","settingsFileName","videoUrl","title","description") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, newId, cameraMode, userId, settingsPath, settingsFileName, externalValue || videoPath, title, description);
    return NextResponse.json({ id: newId }, { status: 201 });
  }

  if (body?.action === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "Settings entry is required." }, { status: 400 });
    await prisma.$executeRawUnsafe(`DELETE FROM "SettingsShowcase" WHERE "id"=$1`, id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
