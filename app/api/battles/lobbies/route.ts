import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isBattleMode } from "@/lib/battles";

function uid() { return crypto.randomUUID(); }

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const lobbies = await prisma.$queryRawUnsafe<any[]>(`SELECT l.id,l.name,l.mode,l."teamMode",l."matchType",l.status,l."maxPlayers",l."createdAt",COUNT(m.id)::int AS "playerCount",u.username AS host FROM "BattleLobby" l JOIN "User" u ON u.id=l."hostId" LEFT JOIN "BattleLobbyMember" m ON m."lobbyId"=l.id WHERE l.status='open' GROUP BY l.id,u.username ORDER BY l."updatedAt" DESC LIMIT 100`);
  return NextResponse.json({ lobbies });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: unknown; mode?: unknown; matchType?: unknown; teamMode?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 48) : "";
  const mode = typeof body?.mode === "string" ? body.mode : "1v1";
  const matchType = body?.matchType === "ranked" ? "ranked" : "casual";
  const teamMode = body?.teamMode === "captains" ? "captains" : "regular";
  if (!name || !isBattleMode(mode)) return NextResponse.json({ error: "Invalid lobby settings." }, { status: 400 });
  const lobbyId = uid();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`INSERT INTO "BattleLobby" ("id","name","hostId","mode","teamMode","matchType") VALUES ($1,$2,$3,$4,$5,$6)`, lobbyId, name, user.id, mode, teamMode, matchType);
    await tx.$executeRawUnsafe(`INSERT INTO "BattleLobbyMember" ("id","lobbyId","userId","isHost") VALUES ($1,$2,$3,true)`, uid(), lobbyId, user.id);
  });
  const origin = request.headers.get("origin") ?? "https://rhythians.vercel.app";
  return NextResponse.json({ lobbyId, url: `${origin}/battles/lobby/${lobbyId}` }, { status: 201 });
}
