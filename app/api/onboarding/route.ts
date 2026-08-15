import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { applyOnboardingAnswers } from "@/lib/onboarding";
import { checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "onboarding", 20, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { optionIds?: unknown } | null;
  const optionIds = Array.isArray(body?.optionIds)
    ? body.optionIds.filter((id): id is string => typeof id === "string")
    : [];

  try {
    const result = await applyOnboardingAnswers(prisma, user.id, optionIds);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save your answers." },
      { status: 400 }
    );
  }
}
