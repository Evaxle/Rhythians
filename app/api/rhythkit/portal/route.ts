import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRhythKitInstallation } from "@/lib/rhythkit-api";
import { getAvatarUrl } from "@/lib/avatar";
import { getRankInfo } from "@/lib/ranks";
import { getOrCreateDailyMap, formatDailyDate, rhpForMap, getDailyLeaderboard } from "@/lib/daily";
import { getSeasonalPath } from "@/lib/seasonal-path";
import { getChallengeMapsWithCompletions, getUserChallengeLevel, getChallengeLevelLeaderboard } from "@/lib/challenge";
import { getOnlineGlobalRankedUsers } from "@/lib/online-users";
import { getVideoUrl, getThumbnailUrl } from "@/lib/clips";
import { getChallengeLeaderboard } from "@/lib/maps-legacy";
import { getModeLeaderboard, syncUserModeScores } from "@/lib/rhythia-mode-points";
import { checkRateLimit } from "@/lib/security";

const GLOBAL_NAME = "global";

async function auth(request: Request) {
  const installation = await getRhythKitInstallation(request);
  if (!installation) return null;
  const user = await prisma.user.findUnique({ where: { id: installation.userId }, include: { rhythiaProfile: true } });
  if (!user || user.isSuspended || (user.suspendedUntil && user.suspendedUntil > new Date())) return null;
  if (user.rhythiaProfile) await prisma.rhythiaProfile.update({ where: { userId: user.id }, data: { isOnline: true, lastActiveAt: new Date(), statusCheckedAt: new Date() } }).catch(() => null);
  return user;
}

async function profilePayload(userId: string, currentId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { rhythiaProfile: true, userTags: { include: { tag: true } }, clips: { where: { status: "approved" }, orderBy: { createdAt: "desc" }, take: 12 } } });
  if (!user) return null;
  const rank = getRankInfo(user.rhp);
  const globalRank = (await prisma.user.count({ where: { rhythiaProfile: { isNot: null }, OR: [{ rhp: { gt: user.rhp } }, { rhp: user.rhp, username: { lt: user.username } }] } })) + 1;
  const challengeLevel = await getUserChallengeLevel(user.id).catch(() => 0);
  const modeSync = user.rhythiaProfile ? await syncUserModeScores(user.id).catch(() => null) : null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    profileHandle: user.profileHandle,
    avatar: getAvatarUrl(user, 256),
    bio: user.bio,
    website: user.website,
    joinedAt: user.joinedAt.toISOString(),
    rhp: user.rhp,
    rank: { name: rank.name, tier: rank.tier, color: rank.color, isExpert: rank.isExpert },
    globalRank,
    challengeLevel,
    online: Boolean(user.rhythiaProfile?.isOnline),
    title: user.rhythiaProfile?.title ?? "Rhythian",
    country: user.rhythiaProfile?.country,
    flag: user.rhythiaProfile?.flag,
    rhythiaProfileUrl: user.rhythiaProfile?.profileUrl,
    verified: user.rhythiaVerified,
    isOwnProfile: user.id === currentId,
    tags: user.userTags.slice(0, 12).map((x) => ({ id: x.tagId, name: x.tag.name, slug: x.tag.slug })),
    modes: { rpl: modeSync?.rpl ?? 0, rps: modeSync?.rps ?? 0 },
    clips: await Promise.all(user.clips.map(async (clip) => ({ id: clip.id, title: clip.title, description: clip.description, songName: clip.songName, cameraMode: clip.cameraMode, storagePath: clip.storagePath, createdAt: clip.createdAt.toISOString(), thumbnailUrl: await getThumbnailUrl(clip.thumbnailPath), videoUrl: await getVideoUrl(clip.storagePath) }))),
  };
}

async function globalConversation() {
  const found = await prisma.conversation.findFirst({ where: { type: "group", name: GLOBAL_NAME } });
  if (found) return found;
  return prisma.conversation.create({ data: { type: "group", name: GLOBAL_NAME } });
}

async function globalMessages() {
  const conversation = await globalConversation();
  const messages = await prisma.message.findMany({ where: { conversationId: conversation.id, isDeleted: false }, orderBy: { createdAt: "desc" }, take: 100, include: { sender: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true } } } });
  return messages.reverse().map((message) => ({ id: message.id, content: message.content, createdAt: message.createdAt.toISOString(), sender: { ...message.sender, avatar: getAvatarUrl(message.sender, 64), rank: getRankInfo(message.sender.rhp) } }));
}

export async function GET(request: Request) {
  const user = await auth(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "home";
  if (page === "profile") {
    const handle = url.searchParams.get("handle") ?? user.profileHandle;
    const profile = await prisma.user.findFirst({ where: { profileHandle: handle }, select: { id: true } });
    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    return NextResponse.json({ profile: await profilePayload(profile.id, user.id) });
  }
  if (page === "search") {
    const q = (url.searchParams.get("q") ?? "").trim();
    const users = await prisma.user.findMany({ where: { id: { not: user.id }, ...(q ? { OR: [{ username: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }, { profileHandle: { contains: q, mode: "insensitive" } }] } : {}) }, take: 30, orderBy: { username: "asc" }, include: { rhythiaProfile: { select: { isOnline: true } } } });
    return NextResponse.json({ users: users.map((entry) => ({ id: entry.id, username: entry.username, displayName: entry.displayName, profileHandle: entry.profileHandle, avatar: getAvatarUrl(entry, 96), rhp: entry.rhp, online: Boolean(entry.rhythiaProfile?.isOnline) })) });
  }
  if (page === "online") return NextResponse.json({ users: await getOnlineGlobalRankedUsers() });
  if (page === "daily") {
    const rank = getRankInfo(user.rhp);
    const daily = await getOrCreateDailyMap(rank.index);
    const beat = await prisma.dailyMapBeat.findUnique({ where: { dailyMapId_userId: { dailyMapId: daily.id, userId: user.id } } });
    return NextResponse.json({ daily: { id: daily.id, date: daily.date.toISOString(), title: daily.title, artist: daily.artist, difficulty: daily.difficulty, starRating: daily.starRating, noteCount: daily.noteCount, length: daily.length, playcount: daily.playcount, downloadUrl: daily.downloadUrl, imageUrl: daily.imageUrl, mapperName: daily.mapperName, reward: rhpForMap(daily.starRating, rank.index) }, rank, streak: user.dailyStreak, beat: beat ? { points: beat.points, accuracy: beat.accuracy, misses: beat.misses, createdAt: beat.createdAt.toISOString() } : null, formattedDate: formatDailyDate(daily.date) });
  }
  if (page === "path") {
    const path = await getSeasonalPath(user.id);
    return NextResponse.json({ path: JSON.parse(JSON.stringify(path, (_, value) => value instanceof Date ? value.toISOString() : value)) });
  }
  if (page === "challenge") {
    const maps = await getChallengeMapsWithCompletions(user.id);
    const level = await getUserChallengeLevel(user.id);
    return NextResponse.json({ maps: JSON.parse(JSON.stringify(maps, (_, value) => value instanceof Date ? value.toISOString() : value)), level });
  }
  if (page === "leaderboards") {
    const ranks = Array.from({ length: 9 }, (_, i) => i);
    const [rhpUsers, daily, ranked, challenge, lock, spin] = await Promise.all([
      prisma.user.findMany({ where: { rhythiaProfile: { isNot: null } }, take: 100, orderBy: [{ rhp: "desc" }, { username: "asc" }], select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true } }),
      Promise.all(ranks.map((index) => getDailyLeaderboard(index, 100))),
      Promise.all(ranks.map((index) => getChallengeLeaderboard(index, 100))),
      getChallengeLevelLeaderboard(100),
      getModeLeaderboard("lock", 100),
      getModeLeaderboard("spin", 100),
    ]);
    return NextResponse.json({ rhp: rhpUsers.map((entry, index) => ({ ...entry, avatar: getAvatarUrl(entry, 64), position: index + 1 })), daily, ranked, challenge, modes: { lock, spin } });
  }
  if (page === "clips") {
    const song = (url.searchParams.get("song") ?? "").trim();
    const where = { status: "approved" as const, ...(song ? { songName: { contains: song, mode: "insensitive" as const } } : {}) };
    const rows = await prisma.clip.findMany({ where, orderBy: { createdAt: "desc" }, take: 24, include: { uploader: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true } }, tags: { include: { tag: true } }, category: true } });
    return NextResponse.json({ clips: await Promise.all(rows.map(async (clip) => ({ id: clip.id, title: clip.title, description: clip.description, songName: clip.songName, cameraMode: clip.cameraMode, storagePath: clip.storagePath, createdAt: clip.createdAt.toISOString(), thumbnailUrl: await getThumbnailUrl(clip.thumbnailPath), videoUrl: await getVideoUrl(clip.storagePath), uploader: { ...clip.uploader, avatar: getAvatarUrl(clip.uploader, 64) }, tags: clip.tags.map((x) => ({ id: x.tag.id, name: x.tag.name, slug: x.tag.slug })), category: clip.category?.name ?? null }))) });
  }
  if (page === "wiki") {
    const articles = await prisma.knowledgeArticle.findMany({ where: { published: true }, orderBy: [{ featured: "desc" }, { updatedAt: "desc" }], take: 100, select: { id: true, title: true, slug: true, description: true, content: true, featured: true, viewCount: true } });
    return NextResponse.json({ articles });
  }
  if (page === "rules") {
    const rules = await prisma.rule.findMany({ where: { enabled: true }, orderBy: { order: "asc" } });
    return NextResponse.json({ rules });
  }
  if (page === "global-chat") return NextResponse.json({ messages: await globalMessages(), onlineCount: (await getOnlineGlobalRankedUsers()).length });
  if (page === "messages") {
    const handle = url.searchParams.get("user") ?? "";
    if (handle) {
      const target = await prisma.user.findFirst({ where: { profileHandle: handle } });
      if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT c.id FROM "Conversation" c JOIN "ConversationMember" a ON a."conversationId"=c.id AND a."userId"=$1 JOIN "ConversationMember" b ON b."conversationId"=c.id AND b."userId"=$2 WHERE c.type='direct' LIMIT 1`, user.id, target.id);
      const conversationId = rows[0]?.id ?? null;
      const messages = conversationId ? await prisma.message.findMany({ where: { conversationId, isDeleted: false }, orderBy: { createdAt: "asc" }, take: 200, include: { sender: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true } } } }) : [];
      return NextResponse.json({ conversationId, target: { id: target.id, username: target.username, displayName: target.displayName, profileHandle: target.profileHandle, avatar: getAvatarUrl(target, 96) }, messages: messages.map((m) => ({ id: m.id, content: m.content, createdAt: m.createdAt.toISOString(), sender: { ...m.sender, avatar: getAvatarUrl(m.sender, 64) } })) });
    }
    return NextResponse.json({ conversations: await prisma.$queryRawUnsafe<any[]>(`SELECT c.id,c.name,c."updatedAt",COUNT(m.id)::int AS "messageCount" FROM "Conversation" c JOIN "ConversationMember" cm ON cm."conversationId"=c.id AND cm."userId"=$1 LEFT JOIN "Message" m ON m."conversationId"=c.id WHERE c.type='direct' GROUP BY c.id ORDER BY c."updatedAt" DESC LIMIT 50`, user.id) });
  }
  return NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.displayName, profileHandle: user.profileHandle, avatar: getAvatarUrl(user, 128), rhp: user.rhp }, pages: ["home","maps","daily","path","challenge","online","leaderboards","battles","clips","search","messages","global-chat","wiki","rules","community","account"] });
}

export async function POST(request: Request) {
  const user = await auth(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; content?: string; userId?: string } | null;
  const action = body?.action ?? "";
  if (action === "global-send") {
    const rate = checkRateLimit(request, "client_global_chat", 30, 60 * 1000);
    if (!rate.allowed) return NextResponse.json({ error: "You are sending messages too quickly.", retryAfter: rate.retryAfterSec }, { status: 429 });
    const content = typeof body?.content === "string" ? body.content.trim().slice(0, 500) : "";
    if (!content) return NextResponse.json({ error: "Message required." }, { status: 400 });
    const conversation = await globalConversation();
    const message = await prisma.message.create({ data: { conversationId: conversation.id, senderId: user.id, content } });
    return NextResponse.json({ ok: true, message: { id: message.id, content: message.content, createdAt: message.createdAt.toISOString(), sender: { id: user.id, username: user.username, displayName: user.displayName, profileHandle: user.profileHandle, avatar: getAvatarUrl(user, 64), rank: getRankInfo(user.rhp) } } });
  }
  if (action === "direct-send") {
    const targetId = typeof body?.userId === "string" ? body.userId : "";
    const content = typeof body?.content === "string" ? body.content.trim().slice(0, 2000) : "";
    if (!targetId || !content || targetId === user.id) return NextResponse.json({ error: "Recipient and message are required." }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT c.id FROM "Conversation" c JOIN "ConversationMember" a ON a."conversationId"=c.id AND a."userId"=$1 JOIN "ConversationMember" b ON b."conversationId"=c.id AND b."userId"=$2 WHERE c.type='direct' LIMIT 1`, user.id, targetId);
    let conversationId = rows[0]?.id ?? null;
    if (!conversationId) {
      const created = await prisma.conversation.create({ data: { type: "direct", createdById: user.id, members: { create: [{ userId: user.id }, { userId: targetId }] } } });
      conversationId = created.id;
    }
    const message = await prisma.message.create({ data: { conversationId, senderId: user.id, content } });
    return NextResponse.json({ ok: true, conversationId, message: { id: message.id, content: message.content, createdAt: message.createdAt.toISOString() } });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
