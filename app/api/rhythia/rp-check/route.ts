import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRhythiaRpGains, getRhythiaRpCredited } from "@/lib/maps";
import { getRankInfo, rhpFromRhythiaRp } from "@/lib/ranks";

export const dynamic = "force-dynamic";

// Returns the current stored RP → RHP status without fetching from Rhythia or
// awarding anything. Used by the settings "check now" panel to show where the
// user stands before they decide to force an update.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { rhp: true, lastRhythiaRpCheckAt: true, rhythiaProfile: { select: { rhythmPoints: true } } },
  });
  if (!row?.rhythiaProfile) {
    return NextResponse.json({ status: "no_profile" });
  }

  const currentRp = row.rhythiaProfile.rhythmPoints ?? 0;
  const target = rhpFromRhythiaRp(currentRp);
  const credited = await getRhythiaRpCredited(user.id);
  const rankInfo = getRankInfo(row.rhp);

  return NextResponse.json({
    status: "ok",
    currentRp,
    target,
    credited,
    rhp: row.rhp,
    rankName: rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`,
    lastCheckedAt: row.lastRhythiaRpCheckAt?.toISOString() ?? null,
  });
}

// Lazy 24-hour Rhythia RP gain check. Called from the profile/settings pages;
// the server only actually re-weights (and fetches from Rhythia) once per 24h,
// unless the caller passes { force: true } (the manual "check now" button).
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const force = Boolean(body?.force);

  try {
    const result = await checkRhythiaRpGains(user.id, force);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check your Rhythia RP." }, { status: 400 });
  }
}
