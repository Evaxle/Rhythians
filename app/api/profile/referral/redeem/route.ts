import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { redeemContributorTag } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const result = await redeemContributorTag(user.id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
