import { NextResponse } from "next/server";
import { rhythiaRequest } from "@/lib/rhythia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function summarize(value: unknown, depth = 0): unknown {
  if (depth > 3) return Array.isArray(value) ? `[array:${value.length}]` : typeof value;
  if (Array.isArray(value)) return value.slice(0, 3).map((entry) => summarize(entry, depth + 1));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    if (/replay|score|beatmap|map|miss|hit|acc|pass|speed|mode|spin|vr|mod|url|file|hash|created|date|time|id/i.test(key)) out[key] = summarize(item, depth + 1);
  }
  return out;
}

export async function GET() {
  try {
    const data = await rhythiaRequest<unknown>("getUserScores", { id: 187782, limit: 30 });
    return NextResponse.json({ ok: true, shape: summarize(data) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
