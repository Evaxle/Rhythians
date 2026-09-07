import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncTournamentRuntime } from "@/lib/tournament-runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (secret && authorization === `Bearer ${secret}`) return true;
  if (secret) {
    const url = new URL(request.url);
    const provided = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
    return provided === secret;
  }
  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const active = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "Tournament" WHERE status='active' ORDER BY "startedAt" ASC NULLS LAST LIMIT 10`);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const tournament of active) {
    try {
      await syncTournamentRuntime(tournament.id);
      results.push({ id: tournament.id, ok: true });
    } catch (error) {
      results.push({ id: tournament.id, ok: false, error: error instanceof Error ? error.message : "Runtime sync failed." });
    }
  }
  return NextResponse.json({ success: results.every((result) => result.ok), active: active.length, results });
}
