import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addCompletionClipComment, type CompletionClipKind } from "@/lib/completion-clips";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  const body = await request.json().catch(() => null) as { kind?: string; clipId?: string; body?: string } | null;
  if (!body?.clipId || !body.body || !["challenge", "category"].includes(body.kind ?? "")) return NextResponse.json({ error: "Invalid comment." }, { status: 400 });
  try {
    const comment = await addCompletionClipComment(body.kind as CompletionClipKind, body.clipId, user.id, body.body);
    return NextResponse.json({ ...comment, userId: user.id, username: user.username, profileHandle: user.profileHandle, createdAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to post comment." }, { status: 400 });
  }
}
