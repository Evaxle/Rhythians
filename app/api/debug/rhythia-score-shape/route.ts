import { NextResponse } from "next/server";
import { rhythiaRequest } from "@/lib/rhythia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function summarize(value: unknown, depth = 0): unknown {
  if (depth > 5) return Array.isArray(value) ? `[array:${value.length}]` : typeof value;
  if (Array.isArray(value)) return value.slice(0, 5).map((entry) => summarize(entry, depth + 1));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    const relevant = /replay|score|beatmap|map|miss|hit|acc|pass|speed|mode|spin|vr|mod|url|file|hash|created|date|time|id|recent|top|history|user/i.test(key);
    if (relevant || Array.isArray(item)) out[key] = summarize(item, depth + 1);
  }
  return out;
}

export async function GET() {
  try {
    const [profile, scores] = await Promise.all([
      rhythiaRequest<unknown>("getProfile", { id: 187782 }),
      rhythiaRequest<unknown>("getUserScores", { id: 187782, limit: 30 }),
    ]);
    return NextResponse.json({ ok: true, profile: summarize(profile), scores: summarize(scores) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
