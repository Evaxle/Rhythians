const RHYTHIA_API_URLS = [
  process.env.RHYTHIA_API_URL,
  "https://production.rhythia.com/api",
  "https://www.rhythia.com/api",
].filter((url): url is string => Boolean(url));

export type RhythiaScore = {
  id: number;
  beatmapTitle: string | null;
  speed: number | null;
  misses: number | null;
  beatmapNotes: number | null;
  awarded_sp: number | null;
  passed: boolean | null;
  rank?: string | null;
};

export function parseRhythiaUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["rhythia.com", "www.rhythia.com"].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/player\/(\d+)\/?$/);
    return match ? { id: Number(match[1]), url: `https://www.rhythia.com/player/${Number(match[1])}` } : null;
  } catch {
    return null;
  }
}

export function parseRhythiaMapUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["rhythia.com", "www.rhythia.com"].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/maps\/(\d+)\/?$/);
    return match ? { id: Number(match[1]), url: `https://www.rhythia.com/maps/${Number(match[1])}` } : null;
  } catch {
    return null;
  }
}

function titleFor(rhythmPoints: number | null, globalRank: number | null) {
  if (globalRank && globalRank <= 30) return "Grandmaster";
  if ((rhythmPoints ?? 0) > 10000) return "Candidate Grandmaster";
  if ((rhythmPoints ?? 0) >= 5000) return "Master";
  if ((rhythmPoints ?? 0) >= 2500) return "Candidate Master";
  if ((rhythmPoints ?? 0) >= 1500) return "Expert";
  return "Novice";
}

async function requestFromApi<T>(baseUrl: string, path: string, body: object): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Rhythians/1.0",
      },
      body: JSON.stringify({ session: "", ...body }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Rhythia API returned ${response.status}.`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function rhythiaRequest<T>(path: string, body: object): Promise<T> {
  let lastError: unknown = null;

  for (const baseUrl of RHYTHIA_API_URLS) {
    try {
      return await requestFromApi<T>(baseUrl, path, body);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("Rhythia took too long to respond.");
  }

  throw new Error("Rhythia could not be reached.");
}

function normalizeName(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase().replace(/[\s_]+/g, "");
}

export function namesMatch(rhythiaUsername: string | null, localNames: (string | null | undefined)[]) {
  const target = normalizeName(rhythiaUsername);
  if (!target) return false;
  return localNames.some((name) => normalizeName(name) === target);
}

export async function fetchRhythiaProfile(id: number) {
  const [profile, scoreData] = await Promise.all([
    rhythiaRequest<{ user?: { id: number; username: string | null; flag: string | null; position: number | null; country_position: number | null; skill_points: number | null } }>("getProfile", { id }),
    rhythiaRequest<{ top?: RhythiaScore[] }>("getUserScores", { id, limit: 10 }),
  ]);
  if (!profile.user || profile.user.id !== id) throw new Error("That Rhythia profile was not found.");
  const rhythmPoints = profile.user.skill_points;
  return {
    profileId: id,
    username: profile.user.username,
    country: profile.user.flag,
    flag: profile.user.flag,
    globalRank: profile.user.position,
    countryRank: profile.user.country_position,
    rhythmPoints,
    title: titleFor(rhythmPoints, profile.user.position),
    scores: scoreData.top ?? [],
  };
}
