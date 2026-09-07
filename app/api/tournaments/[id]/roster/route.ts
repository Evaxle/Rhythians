import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAvatarUrl } from "@/lib/avatar";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const viewer = (await prisma.$queryRawUnsafe<any[]>(`SELECT status FROM "TournamentSignup" WHERE "tournamentId"=$1 AND "userId"=$2`, id, user.id))[0];
  if (!viewer || ["withdrawn","kicked"].includes(String(viewer.status))) return NextResponse.json({ error: "Sign up for this tournament to view the roster." }, { status: 403 });
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT s."userId",s.split,s."rankName",s.status,u.username,u."displayName",u."profileHandle",u.avatar,u."discordId" FROM "TournamentSignup" s JOIN "User" u ON u.id=s."userId" WHERE s."tournamentId"=$1 AND s.status NOT IN ('withdrawn','kicked') ORDER BY s.split,s."signedUpAt"`, id);
  return NextResponse.json({ signups: rows.map((row) => ({ ...row, avatarUrl: getAvatarUrl(row, 96) })) });
}