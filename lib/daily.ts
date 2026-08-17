import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";

const RANKED_SNAPSHOT_KEY = "daily_ranked_maps_snapshot";
const RANKED_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

export type RankedMap = {
  id: number;
  title: string;
  starRating: number | null;
  difficulty: number | null;
  noteCount: number | null;
  length: number | null;
  playcount: number | null;
  downloadUrl: string | null;
  imageUrl: string | null;
  mapHash: string | null;
  ownerUsername: string | null;
};

type RhythiaBeatmap = {
  id: number;
  title: string | null;
  starRating: number | null;
  difficulty: number | null;
  noteCount: number | null;
  length: number | null;
  playcount: number | null;
  beatmapFile: string | null;
  image: string | null;
  mapHash: string | null;
  ownerUsername: string | null;
};

export type RhythiaScoreEntry = {
  id: number;
  beatmapTitle: string | null;
  passed: boolean | null;
  misses: number | null;
  beatmapNotes: number | null;
  accuracy?: number | null;
  created_at?: string | null;
};

export const RHP_BASE_POINTS = 100;
export const RHP_STAR_MULTIPLIER = 100;

export function rhpForMap(starRating: number): number {
  const stars = Number.isFinite(starRating) ? starRating : 0;
  return RHP_BASE_POINTS + Math.round(stars * RHP_STAR_MULTIPLIER);
}

export function startOfDayUTC(value: Date | string = new Date()): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfMonthUTC(value: Date | string = new Date()): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function formatDailyDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function toRankedMap(map: RhythiaBeatmap): RankedMap {
  return {
    id: map.id,
    title: map.title ?? "Unknown map",
    starRating: map.starRating,
    difficulty: map.difficulty,
    noteCount: map.noteCount,
    length: map.length,
    playcount: map.playcount,
    downloadUrl: map.beatmapFile,
    imageUrl: map.image,
    mapHash: map.mapHash,
    ownerUsername: map.ownerUsername,
  };
}

export async function fetchRankedMaps(): Promise<RankedMap[]> {
  const maps: RankedMap[] = [];
  let page = 1;
  let total = Infinity;
  while (maps.length < total && page <= 40) {
    const data = await rhythiaRequest<{ total?: number; beatmaps?: RhythiaBeatmap[] }>("getBeatmaps", {
      status: "RANKED",
      page,
      session: "",
    });
    if (!data.beatmaps || data.beatmaps.length === 0) break;
    if (typeof data.total === "number") total = data.total;
    maps.push(...data.beatmaps.map(toRankedMap));
    page += 1;
  }
  return maps;
}

export async function getRankedMapsCached(): Promise<RankedMap[]> {
  try {
    const cached = await prisma.siteSetting.findUnique({ where: { key: RANKED_SNAPSHOT_KEY } });
    if (cached?.value) {
      const parsed = JSON.parse(cached.value) as { fetchedAt: string; maps: RankedMap[] };
      if (Array.isArray(parsed.maps) && parsed.maps.length > 0 && Date.now() - new Date(parsed.fetchedAt).getTime() < RANKED_SNAPSHOT_TTL_MS) {
        return parsed.maps;
      }
    }
  } catch {
    // Corrupt or missing cache, fetch below.
  }

  const maps = await fetchRankedMaps();
  try {
    await prisma.siteSetting.upsert({
      where: { key: RANKED_SNAPSHOT_KEY },
      update: { value: JSON.stringify({ fetchedAt: new Date().toISOString(), maps }) },
      create: {
        key: RANKED_SNAPSHOT_KEY,
        value: JSON.stringify({ fetchedAt: new Date().toISOString(), maps }),
        description: "Cached snapshot of currently ranked Rhythia beatmaps used to pick daily maps.",
      },
    });
  } catch {
    // Cache write failures shouldn't block the daily pick.
  }
  return maps;
}

export function pickDailyMap(maps: RankedMap[], usedIds: Set<number>, date: Date): RankedMap {
  const available = maps.filter((map) => !usedIds.has(map.id));
  const pool = available.length > 0 ? available : maps;
  const seed = Math.floor(date.getTime() / 86_400_000);
  const random = mulberry32(seed);
  const shuffled = shuffle(pool, random);
  return shuffled[0];
}

export async function getOrCreateDailyMap(
  date: Date | string = new Date(),
  blockedIds: number[] = []
): Promise<{
  id: string;
  date: Date;
  beatmapId: number;
  title: string;
  artist: string | null;
  difficulty: number | null;
  starRating: number;
  noteCount: number | null;
  length: number | null;
  playcount: number | null;
  mapHash: string | null;
  downloadUrl: string;
  imageUrl: string | null;
  mapperName: string | null;
  createdAt: Date;
}> {
  const day = startOfDayUTC(date);

  const existing = await prisma.dailyMap.findUnique({ where: { date: day } });
  if (existing) return existing;

  const maps = await getRankedMapsCached();
  const monthStart = startOfMonthUTC(day);
  const used = await prisma.dailyMap.findMany({
    where: { date: { gte: monthStart } },
    select: { beatmapId: true },
  });
  const usedIds = new Set(used.map((record) => record.beatmapId));
  blockedIds.forEach((id) => usedIds.add(id));
  const pick = pickDailyMap(maps, usedIds, day);

  const dash = pick.title.indexOf(" - ");
  const artist = dash > 0 ? pick.title.slice(0, dash).trim() : null;

  try {
    return await prisma.dailyMap.create({
      data: {
        date: day,
        beatmapId: pick.id,
        title: pick.title,
        artist,
        difficulty: pick.difficulty,
        starRating: pick.starRating ?? 0,
        noteCount: pick.noteCount,
        length: pick.length,
        playcount: pick.playcount,
        mapHash: pick.mapHash,
        downloadUrl: pick.downloadUrl ?? "",
        imageUrl: pick.imageUrl,
        mapperName: pick.ownerUsername,
      },
    });
  } catch (error) {
    // A concurrent request may have created the daily map first.
    const created = await prisma.dailyMap.findUnique({ where: { date: day } });
    if (created) return created;
    throw error;
  }
}

function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findScoreForMap(scores: RhythiaScoreEntry[], title: string): RhythiaScoreEntry | null {
  const target = normalizeTitle(title);
  if (!target) return null;
  return scores.find((score) => score.passed && normalizeTitle(score.beatmapTitle) === target) ?? null;
}

export async function fetchRhythiaScores(profileId: number): Promise<{ recent: RhythiaScoreEntry[]; top: RhythiaScoreEntry[] }> {
  const data = await rhythiaRequest<{ lastDay?: RhythiaScoreEntry[]; top?: RhythiaScoreEntry[] }>("getUserScores", { id: profileId, limit: 100 });
  return { recent: data.lastDay ?? [], top: data.top ?? [] };
}

export type DailyCheckResult = {
  status: "beat" | "not_beat" | "already" | "no_profile";
  points: number;
};

export async function checkAndAwardDaily(userId: string): Promise<DailyCheckResult> {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId } });
  if (!profile) return { status: "no_profile", points: 0 };

  const daily = await getOrCreateDailyMap();

  const existing = await prisma.dailyMapBeat.findUnique({
    where: { dailyMapId_userId: { dailyMapId: daily.id, userId } },
  });
  if (existing) return { status: "already", points: existing.points };

  let scores: { recent: RhythiaScoreEntry[]; top: RhythiaScoreEntry[] };
  try {
    scores = await fetchRhythiaScores(profile.profileId);
  } catch {
    return { status: "not_beat", points: 0 };
  }

  const hit = findScoreForMap(scores.recent, daily.title) ?? findScoreForMap(scores.top, daily.title);
  if (!hit) return { status: "not_beat", points: 0 };

  const points = rhpForMap(daily.starRating);

  try {
    await prisma.$transaction([
      prisma.dailyMapBeat.create({
        data: {
          dailyMapId: daily.id,
          userId,
          points,
          scoreId: hit.id,
          accuracy: hit.accuracy ?? null,
          misses: hit.misses,
        },
      }),
      prisma.user.update({ where: { id: userId }, data: { rhp: { increment: points } } }),
      prisma.rhpTransaction.create({
        data: {
          userId,
          amount: points,
          reason: "daily_map",
          description: `Beaten daily map: ${daily.title}`,
        },
      }),
      prisma.notification.create({
        data: {
          userId,
          type: "rhp_earned",
          title: "Daily map beaten",
          message: `You earned ${points} RHP for beating today's daily map: ${daily.title}.`,
          url: "/daily",
        },
      }),
    ]);
  } catch {
    // Likely a race: already awarded by a concurrent request.
    const beat = await prisma.dailyMapBeat.findUnique({
      where: { dailyMapId_userId: { dailyMapId: daily.id, userId } },
    });
    if (beat) return { status: "already", points: beat.points };
    throw new Error("Unable to record the daily map completion.");
  }

  return { status: "beat", points };
}

export type DailyLeaderboardRow = {
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  rhp: number;
  count: number;
  totalPoints: number;
  lastBeatAt: Date;
};

export async function getDailyLeaderboard(monthStart: Date, monthEnd: Date, limit = 50): Promise<DailyLeaderboardRow[]> {
  const beats = await prisma.dailyMapBeat.findMany({
    where: { dailyMap: { date: { gte: monthStart, lt: monthEnd } } },
    include: {
      user: { select: { id: true, username: true, displayName: true, profileHandle: true, avatar: true, rhp: true } },
    },
  });

  const grouped = new Map<string, DailyLeaderboardRow>();
  for (const beat of beats) {
    const row = grouped.get(beat.userId);
    if (row) {
      row.count += 1;
      row.totalPoints += beat.points;
      if (beat.createdAt > row.lastBeatAt) row.lastBeatAt = beat.createdAt;
    } else {
      grouped.set(beat.userId, {
        userId: beat.userId,
        username: beat.user.username,
        displayName: beat.user.displayName,
        profileHandle: beat.user.profileHandle,
        avatar: beat.user.avatar,
        rhp: beat.user.rhp,
        count: 1,
        totalPoints: beat.points,
        lastBeatAt: beat.createdAt,
      });
    }
  }

  return [...grouped.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.totalPoints - a.totalPoints ||
        a.lastBeatAt.getTime() - b.lastBeatAt.getTime()
    )
    .slice(0, limit);
}

export async function getUserDailyStatus(userId: string) {
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return null;

  const daily = await getOrCreateDailyMap();
  const beat = await prisma.dailyMapBeat.findUnique({
    where: { dailyMapId_userId: { dailyMapId: daily.id, userId } },
    select: { points: true, createdAt: true, accuracy: true, misses: true, scoreId: true },
  });
  return {
    dailyMapId: daily.id,
    beat: beat
      ? { points: beat.points, createdAt: beat.createdAt, accuracy: beat.accuracy, misses: beat.misses, scoreId: beat.scoreId }
      : null,
  };
}

export async function refreshTodayDailyMap(blockedIds: number[] = []): Promise<{ map: Awaited<ReturnType<typeof getOrCreateDailyMap>>; replaced: boolean }> {
  const day = startOfDayUTC();
  const existing = await prisma.dailyMap.findUnique({ where: { date: day } });

  if (existing) {
    await prisma.dailyMapBeat.deleteMany({ where: { dailyMapId: existing.id } });
    await prisma.dailyMap.delete({ where: { id: existing.id } });
    return { map: await getOrCreateDailyMap(day, [...blockedIds, existing.beatmapId]), replaced: true };
  }

  return { map: await getOrCreateDailyMap(day, blockedIds), replaced: false };
}

export async function fetchRhythiaMapById(beatmapId: number) {
  const data = await rhythiaRequest<{ total?: number; beatmaps?: Array<{
    id: number;
    title: string | null;
    starRating: number | null;
    difficulty: number | null;
    noteCount: number | null;
    length: number | null;
    playcount: number | null;
    beatmapFile: string | null;
    image: string | null;
    mapHash: string | null;
    ownerUsername: string | null;
    status: string | null;
  }> }>("getBeatmaps", { textFilter: String(beatmapId), page: 1 });
  const match = (data.beatmaps ?? []).find((map) => map.id === beatmapId);
  if (!match) return null;
  return toRankedMap(match);
}