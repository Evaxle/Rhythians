const RHYTHIA_API_URLS = [
  process.env.RHYTHIA_API_URL,
  "https://production.rhythia.com/api",
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

function buildUrl(baseUrl: string, path: string, body: Record<string, unknown>) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path}`);
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

async function readApiResponse<T>(response: Response, endpoint: string): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok) {
    const detail = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(`Rhythia API returned ${response.status}${detail ? `: ${detail}` : ""}.`);
  }
  if (!contentType.includes("json")) {
    if (/^\s*<!doctype html/i.test(text) || /<html[\s>]/i.test(text)) throw new Error(`Rhythia API endpoint ${endpoint} returned an HTML page instead of JSON.`);
    throw new Error(`Rhythia API endpoint ${endpoint} returned a non-JSON response.`);
  }
  try {
    const data = JSON.parse(text) as T & { error?: string; message?: string };
    if (data.error) throw new Error(data.error);
    if (data.message && !Object.keys(data as object).some((key) => key !== "message")) throw new Error(data.message);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message !== "Unexpected end of JSON input") throw error;
    throw new Error("Rhythia returned invalid JSON.");
  }
}

async function requestFromApi<T>(baseUrl: string, path: string, body: Record<string, unknown>): Promise<T> {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Rhythians/1.0" },
      body: JSON.stringify({ session: "", ...body }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 405) {
      const getResponse = await fetch(buildUrl(baseUrl, path, { session: "", ...body }), { method: "GET", headers: { accept: "application/json", "user-agent": "Rhythians/1.0" }, cache: "no-store", signal: controller.signal });
      return await readApiResponse<T>(getResponse, `${baseUrl}/${path}`);
    }
    return await readApiResponse<T>(response, endpoint);
  } finally {
    clearTimeout(timeout);
  }
}

export async function rhythiaRequest<T>(path: string, body: object): Promise<T> {
  let lastError: unknown = null;
  const requestBody = { ...body } as Record<string, unknown>;
  if (path === "getUserScores") {
    delete requestBody.offset;
    delete requestBody.page;
  }
  for (const baseUrl of RHYTHIA_API_URLS) {
    try {
      return await requestFromApi<T>(baseUrl, path, requestBody);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) {
    if (lastError.name === "AbortError") throw new Error("Rhythia took too long to respond.");
    throw lastError;
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

function findBio(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const directKeys = ["bio", "about", "aboutMe", "about_me", "description"];
  for (const key of directKeys) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key];
  }
  for (const key of ["user", "profile", "data"]) {
    const nested = findBio(record[key]);
    if (nested) return nested;
  }
  return null;
}

export async function fetchRhythiaProfile(id: number) {
  const profile = await rhythiaRequest<Record<string, unknown>>("getProfile", { id });
  const user = profile.user && typeof profile.user === "object" ? profile.user as Record<string, unknown> : null;
  const userId = typeof user?.id === "number" ? user.id : null;
  if (!user || userId !== id) throw new Error("That Rhythia profile was not found.");
  let scores: RhythiaScore[] = [];
  try {
    const scoreData = await rhythiaRequest<{ top?: RhythiaScore[] }>("getUserScores", { id, limit: 10 });
    scores = scoreData.top ?? [];
  } catch {
  }
  const username = typeof user.username === "string" ? user.username : null;
  const flag = typeof user.flag === "string" ? user.flag : null;
  const globalRank = typeof user.position === "number" ? user.position : null;
  const countryRank = typeof user.country_position === "number" ? user.country_position : null;
  const rhythmPoints = typeof user.skill_points === "number" ? user.skill_points : null;
  return {
    profileId: id,
    username,
    bio: findBio(profile),
    country: flag,
    flag,
    globalRank,
    countryRank,
    rhythmPoints,
    title: titleFor(rhythmPoints, globalRank),
    scores,
  };
}
