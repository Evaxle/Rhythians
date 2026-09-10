import { NextResponse } from "next/server";
import { rhythiaRequest } from "@/lib/rhythia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function summarize(value: unknown, depth = 0): unknown {
  if (depth > 6) return Array.isArray(value) ? `[array:${value.length}]` : typeof value;
  if (Array.isArray(value)) return value.slice(0, 8).map((entry) => summarize(entry, depth + 1));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    const relevant = /replay|score|beatmap|map|miss|hit|acc|pass|speed|mode|spin|vr|mod|url|file|hash|created|date|time|id|recent|top|history|user|song|owner|mapper/i.test(key);
    if (relevant || Array.isArray(item)) out[key] = summarize(item, depth + 1);
  }
  return out;
}

async function attempt(path: string, body: Record<string, unknown>) {
  try { return { ok: true, data: summarize(await rhythiaRequest<unknown>(path, body)) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function GET() {
  const id = 7151911;
  const lookups = await Promise.all([
    attempt("getScore", { id }),
    attempt("getScoreInfo", { id }),
    attempt("getReplay", { id }),
    attempt("getScoreReplay", { id }),
  ]);
  let page: unknown = null;
  try {
    const response = await fetch(`https://www.rhythia.com/score/${id}`, { cache: "no-store", redirect: "follow", headers: { accept: "text/html", "user-agent": "Rhythians/7.0" } });
    const html = await response.text();
    const replayUrls = [...html.matchAll(/https?:\\?\/\\?\/[^\"'<>\\s]+(?:\.rhr|replay)[^\"'<>\\s]*/gi)].slice(0, 10).map((match) => match[0]);
    const userIds = [...html.matchAll(/(?:userId|user_id|profileId|playerId)[\"']?\s*[:=]\s*[\"']?(\d+)/gi)].slice(0, 10).map((match) => match[1]);
    page = { status: response.status, length: html.length, replayUrls, userIds };
  } catch (error) { page = { error: error instanceof Error ? error.message : "Unknown error" }; }
  return NextResponse.json({ id, getScore: lookups[0], getScoreInfo: lookups[1], getReplay: lookups[2], getScoreReplay: lookups[3], page });
}
