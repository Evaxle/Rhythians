import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const REPORT_REASONS = [
  "Spam or advertising",
  "Harassment or hate",
  "Inappropriate content",
  "Impersonation",
  "Broken or misleading content",
  "Other",
];

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "reports", 10, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You're submitting too many reports. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const reporter = await getSessionUser();
  if (!reporter) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    targetType?: unknown;
    targetId?: unknown;
    reason?: unknown;
    description?: unknown;
  } | null;

  const targetType = body?.targetType;
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 1000) : null;

  if (targetType !== "user" && targetType !== "clip") {
    return NextResponse.json({ error: "targetType must be user or clip." }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ error: "A report target is required." }, { status: 400 });
  }
  if (!reason || !REPORT_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Please pick a reason for your report." }, { status: 400 });
  }

  if (targetType === "user") {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (target.id === reporter.id) {
      return NextResponse.json({ error: "You can't report yourself." }, { status: 400 });
    }
  } else {
    const target = await prisma.clip.findUnique({ where: { id: targetId } });
    if (!target) return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  }

  const existing = await prisma.report.findFirst({
    where: { reporterId: reporter.id, targetType, targetId, status: "open" },
  });
  if (existing) {
    return NextResponse.json({ error: "You have already reported this. Our team will review it." }, { status: 409 });
  }

  const report = await prisma.report.create({
    data: {
      reporterId: reporter.id,
      targetType,
      targetId,
      reason,
      description,
      status: "open",
    },
  });

  return NextResponse.json({ report: { id: report.id, status: report.status } });
}
