import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isOwner } from "@/lib/auth";
import { getMessageRetentionDays, setMessageRetentionDays, pruneExpiredMessages } from "@/lib/settings";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const retentionDays = await getMessageRetentionDays();
  return NextResponse.json({ retentionDays });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isOwner(user)) {
    return NextResponse.json({ error: "Only the site owner can change message settings." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { retentionDays?: unknown; prune?: unknown } | null;

  if (body?.prune === true) {
    await pruneExpiredMessages();
  }

  if (typeof body?.retentionDays === "number" && Number.isFinite(body.retentionDays) && body.retentionDays >= 1 && body.retentionDays <= 3650) {
    await setMessageRetentionDays(Math.round(body.retentionDays));
  }

  return NextResponse.json({ retentionDays: await getMessageRetentionDays() });
}
