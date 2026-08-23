import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isBattleMode } from "@/lib/battles";

type Props = { params: Promise<{ lobbyId: string }> };
function uid() { return crypto.randomUUID(); }
async function access(lobbyId: string, userId: string) { return prisma.$queryRawUnsafe<any[]>(`SELECT l.*,m."isHost",m."isReady" FROM "BattleLobby" l JOIN "BattleLobbyMember" m ON m."lobbyId"=l.id AND m."userId"=$2 WHERE l.id=$1`, lobbyId, userId).then((rows) => rows[0]); }

export async function GET(_: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { lobbyId } = await params;
  const lobby = await prisma.$queryRawUnsafe<any[]>(`SELECT l.*,u.username AS host FROM "BattleLobby" l JOIN "User" u ON u.id=l."hostId" WHERE l.id=$1`, lobbyId);
  if (!lobby[0]) return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  const members = await prisma.$queryRawUnsafe<any[]>(`SELECT u.id,u.username,u."displayName",u."profileHandle",u.avatar,u.rhp,m."isHost",m."isReady" FROM "BattleLobbyMember" m JOIN "User" u ON u.id=m."userId" WHERE m."lobbyId"=$1 ORDER BY m."joinedAt"`, lobbyId);
  const messages = await prisma.$queryRawUnsafe<any[]>(`SELECT x.id,x.content,x."createdAt",u.username,u."profileHandle" FROM "BattleLobbyMessage" x JOIN "User" u ON u.id=x."userId" WHERE x."lobbyId"=$1 ORDER BY x."createdAt" DESC LIMIT 100`, lobbyId);
  const votes = await prisma.$queryRawUnsafe<any[]>(`SELECT "mapId",COUNT(*)::int AS votes FROM "BattleLobbyMapVote" WHERE "lobbyId"=$1 GROUP BY "mapId" ORDER BY votes DESC`, lobbyId);
  return NextResponse.json({ lobby: lobby[0], members, messages: messages.reverse(), votes, viewerIsMember: !!(await access(lobbyId, user.id)) });
}

export async function PATCH(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { lobbyId } = await params;
  const body = await request.json().catch(() => null) as { action?: unknown; mode?: unknown; mapId?: unknown; content?: unknown; userId?: unknown } | null;
  const action = body?.action;
  if (action === "join") {
    const lobby = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "BattleLobby" WHERE id=$1 AND status='open'`, lobbyId);
    if (!lobby[0]) return NextResponse.json({ error: "Lobby not found or closed." }, { status: 404 });
    const count = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS count FROM "BattleLobbyMember" WHERE "lobbyId"=$1`, lobbyId);
    if (count[0].count >= lobby[0].maxPlayers) return NextResponse.json({ error: "Lobby is full." }, { status: 400 });
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleLobbyMember" ("id","lobbyId","userId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, uid(), lobbyId, user.id);
    return NextResponse.json({ ok: true });
  }
  const accessRow = await access(lobbyId, user.id);
  if (!accessRow) return NextResponse.json({ error: "You are not in this lobby." }, { status: 403 });
  if (action === "invite") {
    if (!accessRow.isHost || typeof body?.userId !== "string") return NextResponse.json({ error: "Only the host can invite users." }, { status: 403 });
    const target = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleLobbyMember" ("id","lobbyId","userId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, uid(), lobbyId, target.id);
    await prisma.notification.create({ data: { userId: target.id, type: "announcement", title: "Lobby invite", message: `${user.displayName ?? user.username} invited you to ${accessRow.name}.`, url: `/battles/lobby/${lobbyId}` } });
    return NextResponse.json({ ok: true });
  }
  if (action === "leave") { await prisma.$executeRawUnsafe(`DELETE FROM "BattleLobbyMember" WHERE "lobbyId"=$1 AND "userId"=$2`, lobbyId, user.id); return NextResponse.json({ ok: true }); }
  if (action === "mode") {
    if (!accessRow.isHost || typeof body?.mode !== "string" || !isBattleMode(body.mode)) return NextResponse.json({ error: "Only the host can change the mode." }, { status: 400 });
    await prisma.$executeRawUnsafe(`UPDATE "BattleLobby" SET "mode"=$2,"updatedAt"=NOW() WHERE id=$1`, lobbyId, body.mode); return NextResponse.json({ ok: true });
  }
  if (action === "vote") {
    if (typeof body?.mapId !== "string") return NextResponse.json({ error: "Map required." }, { status: 400 });
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleLobbyMapVote" ("id","lobbyId","userId","mapId") VALUES ($1,$2,$3,$4) ON CONFLICT ("lobbyId","userId") DO UPDATE SET "mapId"=EXCLUDED."mapId","createdAt"=NOW()`, uid(), lobbyId, user.id, body.mapId); return NextResponse.json({ ok: true });
  }
  if (action === "message") {
    if (typeof body?.content !== "string" || !body.content.trim()) return NextResponse.json({ error: "Message required." }, { status: 400 });
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleLobbyMessage" ("id","lobbyId","userId","content") VALUES ($1,$2,$3,$4)`, uid(), lobbyId, user.id, body.content.trim().slice(0, 2000)); return NextResponse.json({ ok: true });
  }
  if (action === "ready") { await prisma.$executeRawUnsafe(`UPDATE "BattleLobbyMember" SET "isReady"=NOT "isReady" WHERE "lobbyId"=$1 AND "userId"=$2`, lobbyId, user.id); return NextResponse.json({ ok: true }); }
  if (action === "start") {
    if (!accessRow.isHost) return NextResponse.json({ error: "Only the host can start the match." }, { status: 403 });
    const members = await prisma.$queryRawUnsafe<any[]>(`SELECT "userId" FROM "BattleLobbyMember" WHERE "lobbyId"=$1`, lobbyId);
    const required = Number(accessRow.mode.split("v")[0]) * 2;
    if (members.length !== required) return NextResponse.json({ error: `This mode requires exactly ${required} players.` }, { status: 400 });
    const votes = await prisma.$queryRawUnsafe<any[]>(`SELECT "mapId",COUNT(*)::int AS votes FROM "BattleLobbyMapVote" WHERE "lobbyId"=$1 GROUP BY "mapId" ORDER BY votes DESC,"mapId" LIMIT 1`, lobbyId);
    const matchId = uid();
    await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatch" ("id","matchType","mode","status","mapId","startedAt") VALUES ($1,$2,$3,'active',$4,NOW())`, matchId, accessRow.matchType, accessRow.mode, votes[0]?.mapId ?? null);
    for (let index = 0; index < members.length; index += 1) await prisma.$executeRawUnsafe(`INSERT INTO "BattleMatchPlayer" ("id","matchId","userId","team") VALUES ($1,$2,$3,$4)`, uid(), matchId, members[index].userId, index % 2 === 0 ? 1 : 2);
    await prisma.$executeRawUnsafe(`UPDATE "BattleLobby" SET status='started',"updatedAt"=NOW() WHERE id=$1`, lobbyId);
    return NextResponse.json({ matchId });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
