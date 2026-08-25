import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

const bucket = () => process.env.STORAGE_BUCKET ?? "media";
const MAX_SETTINGS_SIZE = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;
const settingsExtension = (name: string) => /\.rhs$/i.test(name);
const videoExtension = (name: string) => /\.(mp4|webm|mov|m4v|mkv|avi|wmv|flv|mpeg|mpg|3gp|ogv|ts|mts|m2ts)$/i.test(name);

async function authorize() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!(await canAccessAdmin(user))) return { response: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; cameraMode: string; userId: string; settingsFileUrl: string; settingsFileName: string; videoUrl: string; title: string | null; description: string | null; username: string; displayName: string | null; profileHandle: string; globalRank: number | null; profileUrl: string }>>(`SELECT s."id",s."cameraMode",s."userId",s."settingsFileUrl",s."settingsFileName",s."videoUrl",s."title",s."description",u."username",u."displayName",u."profileHandle",rp."globalRank",rp."profileUrl" FROM "SettingsShowcase" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u."id" ORDER BY s."cameraMode",COALESCE(rp."globalRank",2147483647),s."createdAt" ASC`);
  return NextResponse.json({ settings: rows });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  if (!supabaseAdmin) return NextResponse.json({ error: "Storage service is not configured." }, { status: 500 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.action === "upload") {
    const settingsFileName = typeof body.settingsFileName === "string" ? body.settingsFileName.trim() : "";
    const videoFileName = typeof body.videoFileName === "string" ? body.videoFileName.trim() : "";
    const settingsFileSize = Number(body.settingsFileSize);
    const videoFileSize = Number(body.videoFileSize);
    const settingsContentType = typeof body.settingsContentType === "string" ? body.settingsContentType : "application/octet-stream";
    const videoContentType = typeof body.videoContentType === "string" ? body.videoContentType : "video/mp4";
    if (!settingsExtension(settingsFileName)) return NextResponse.json({ error: "Settings file must be an .rhs file." }, { status: 400 });
    if (!videoExtension(videoFileName)) return NextResponse.json({ error: "Unsupported video file type. Supported video formats include MP4, WebM, MOV, M4V, MKV, AVI, WMV, FLV, MPEG, MPG, 3GP, OGV, TS, MTS, and M2TS." }, { status: 400 });
    if (!Number.isFinite(settingsFileSize) || settingsFileSize <= 0 || settingsFileSize > MAX_SETTINGS_SIZE) return NextResponse.json({ error: "Settings file must be between 1 byte and 25 MB." }, { status: 400 });
    if (!Number.isFinite(videoFileSize) || videoFileSize <= 0 || videoFileSize > MAX_VIDEO_SIZE) return NextResponse.json({ error: "Video must be between 1 byte and 250 MB." }, { status: 400 });
    const settingsPath = `settings/${randomUUID()}/${settingsFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const videoPath = `settings/${randomUUID()}/${videoFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const [settingsUpload, videoUpload] = await Promise.all([supabaseAdmin.storage.from(bucket()).createSignedUploadUrl(settingsPath), supabaseAdmin.storage.from(bucket()).createSignedUploadUrl(videoPath)]);
    if (settingsUpload.error || !settingsUpload.data || videoUpload.error || !videoUpload.data) return NextResponse.json({ error: "Could not create upload URLs." }, { status: 500 });
    return NextResponse.json({ settingsUploadUrl: settingsUpload.data.signedUrl, videoUploadUrl: videoUpload.data.signedUrl, settingsPublicUrl: supabaseAdmin.storage.from(bucket()).getPublicUrl(settingsPath).data.publicUrl, videoPublicUrl: supabaseAdmin.storage.from(bucket()).getPublicUrl(videoPath).data.publicUrl, settingsPath, videoPath, settingsContentType, videoContentType });
  }
  if (body?.action === "create" || body?.action === "update") {
    const id = typeof body.id === "string" ? body.id : "";
    const cameraMode = body.cameraMode === "spin" ? "spin" : body.cameraMode === "lock" ? "lock" : "";
    const userId = typeof body.userId === "string" ? body.userId : "";
    const settingsPath = typeof body.settingsPath === "string" ? body.settingsPath : "";
    const videoPath = typeof body.videoPath === "string" ? body.videoPath : "";
    const settingsFileName = typeof body.settingsFileName === "string" ? body.settingsFileName : "";
    const title = typeof body.title === "string" ? body.title.trim() || null : null;
    const description = typeof body.description === "string" ? body.description.trim() || null : null;
    if (!cameraMode || !userId) return NextResponse.json({ error: "Camera mode and connected user are required." }, { status: 400 });
    const linked = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { userId: true } });
    if (!linked) return NextResponse.json({ error: "The selected user does not have a connected Rhythia account." }, { status: 400 });
    if (body.action === "create" && (!settingsPath || !videoPath || !settingsFileName)) return NextResponse.json({ error: "Settings and video files are required." }, { status: 400 });
    if (body.action === "update") {
      if (!id) return NextResponse.json({ error: "Settings entry is required." }, { status: 400 });
      const current = await prisma.$queryRawUnsafe<Array<{ id: string; settingsFileUrl: string; settingsFileName: string; videoUrl: string }>>(`SELECT "id","settingsFileUrl","settingsFileName","videoUrl" FROM "SettingsShowcase" WHERE "id"=$1 LIMIT 1`, id);
      if (!current[0]) return NextResponse.json({ error: "Settings entry not found." }, { status: 404 });
      const settingsUrl = settingsPath ? supabaseAdmin.storage.from(bucket()).getPublicUrl(settingsPath).data.publicUrl : current[0].settingsFileUrl;
      const videoUrl = videoPath ? supabaseAdmin.storage.from(bucket()).getPublicUrl(videoPath).data.publicUrl : current[0].videoUrl;
      const fileName = settingsFileName || current[0].settingsFileName;
      await prisma.$executeRawUnsafe(`UPDATE "SettingsShowcase" SET "cameraMode"=$1,"userId"=$2,"settingsFileUrl"=$3,"settingsFileName"=$4,"videoUrl"=$5,"title"=$6,"description"=$7 WHERE "id"=$8`, cameraMode, userId, settingsUrl, fileName, videoUrl, title, description, id);
      return NextResponse.json({ id });
    }
    const newId = randomUUID();
    const settingsUrl = supabaseAdmin.storage.from(bucket()).getPublicUrl(settingsPath).data.publicUrl;
    const videoUrl = supabaseAdmin.storage.from(bucket()).getPublicUrl(videoPath).data.publicUrl;
    await prisma.$executeRawUnsafe(`INSERT INTO "SettingsShowcase" ("id","cameraMode","userId","settingsFileUrl","settingsFileName","videoUrl","title","description") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, newId, cameraMode, userId, settingsUrl, settingsFileName, videoUrl, title, description);
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
