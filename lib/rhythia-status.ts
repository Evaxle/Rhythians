import { prisma } from "@/lib/db";

const RHYTHIA_API = "https://production.rhythia.com/api";
const STATUS_TTL_MS = 60_000;
const ONLINE_COUNT_TTL_MS = 60_000;
const ONLINE_COUNT_KEY = "online_users_count";

async function fetchRhythiaStatus(profileId: number): Promise<{ isOnline: boolean; lastActiveAt: Date | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${RHYTHIA_API}/getProfile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: "", id: profileId }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Rhythia could not be reached.");
    const data = await response.json();
    const user = data?.user;
    if (!user || !user.id) throw new Error("Rhythia profile not found.");
    return {
      isOnline: Boolean(user.is_online),
      lastActiveAt: typeof user.last_active_timestamp === "number" ? new Date(user.last_active_timestamp) : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export type RhythiaStatusRow = {
  id: string;
  profileId: number;
  isOnline: boolean | null;
  lastActiveAt: Date | null;
  statusCheckedAt: Date | null;
};

export async function refreshRhythiaStatus(profile: RhythiaStatusRow) {
  const status = await fetchRhythiaStatus(profile.profileId);
  await prisma.rhythiaProfile.update({
    where: { id: profile.id },
    data: {
      isOnline: status.isOnline,
      lastActiveAt: status.lastActiveAt,
      statusCheckedAt: new Date(),
    },
  });
  return status;
}

export async function getRhythiaStatus(profile: RhythiaStatusRow): Promise<{ isOnline: boolean; lastActiveAt: Date | null }> {
  const stale = !profile.statusCheckedAt || Date.now() - profile.statusCheckedAt.getTime() > STATUS_TTL_MS;
  if (stale) {
    try {
      return await refreshRhythiaStatus(profile);
    } catch {
      // Fall back to the cached value if Rhythia is unreachable.
    }
  }
  return { isOnline: Boolean(profile.isOnline), lastActiveAt: profile.lastActiveAt };
}

async function computeOnlineUserCount(): Promise<number> {
  const profiles = await prisma.rhythiaProfile.findMany({
    select: { id: true, profileId: true, isOnline: true, lastActiveAt: true, statusCheckedAt: true },
  });

  const CHUNK = 5;
  for (let i = 0; i < profiles.length; i += CHUNK) {
    const chunk = profiles.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (profile) => {
        const stale = !profile.statusCheckedAt || Date.now() - profile.statusCheckedAt.getTime() > STATUS_TTL_MS;
        if (stale) {
          try {
            await refreshRhythiaStatus(profile);
          } catch {
            // Ignore unreachable players so one bad fetch doesn't block the count.
          }
        }
      })
    );
  }

  const fresh = await prisma.rhythiaProfile.findMany({ select: { isOnline: true } });
  return fresh.filter((profile) => profile.isOnline).length;
}

export async function getOnlineUserCount(): Promise<number> {
  try {
    const cached = await prisma.siteSetting.findUnique({ where: { key: ONLINE_COUNT_KEY } });
    if (cached?.value) {
      try {
        const parsed = JSON.parse(cached.value) as { count: number; at: number };
        if (Number.isFinite(parsed.count) && Date.now() - parsed.at < ONLINE_COUNT_TTL_MS) {
          return parsed.count;
        }
      } catch {
        // Corrupt cache entry, recompute below.
      }
    }
  } catch {
    // Fall through and compute fresh.
  }

  const count = await computeOnlineUserCount();
  try {
    await prisma.siteSetting.upsert({
      where: { key: ONLINE_COUNT_KEY },
      update: { value: JSON.stringify({ count, at: Date.now() }) },
      create: {
        key: ONLINE_COUNT_KEY,
        value: JSON.stringify({ count, at: Date.now() }),
        description: "Cached count of linked Rhythia players currently online.",
      },
    });
  } catch {
    // Cache write failures shouldn't fail the request.
  }
  return count;
}