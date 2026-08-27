import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRhythKitInstallation } from "@/lib/rhythkit-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const rows = await prisma.$queryRawUnsafe<Array<{ username: string; rhp: number; globalRank: number; profileGlobalRank: number | null }>>(
    `SELECT u."username", u."rhp", (SELECT COUNT(*) + 1 FROM "User" higher WHERE higher."rhp" > u."rhp")::int AS "globalRank", rp."globalRank" AS "profileGlobalRank" FROM "User" u LEFT JOIN "RhythiaProfile" rp ON rp."userId" = u."id" WHERE u."id" = $1 LIMIT 1`,
    installation.userId
  );
  const user = rows[0];
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({
    ok: true,
    user: {
      username: user.username,
      rhp: Math.max(0, Math.floor(user.rhp)),
      globalRank: user.profileGlobalRank ?? user.globalRank,
    },
  });
}
