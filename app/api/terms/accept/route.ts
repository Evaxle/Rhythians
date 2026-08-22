import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const TERMS_VERSION = "2026-08-22";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  await prisma.$executeRaw`
    INSERT INTO "TermsAcceptance" ("id", "userId", "version", "acceptedAt")
    VALUES (${randomUUID()}, ${user.id}, ${TERMS_VERSION}, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE
    SET "version" = EXCLUDED."version", "acceptedAt" = CURRENT_TIMESTAMP
  `;

  return NextResponse.json({ accepted: true, version: TERMS_VERSION });
}
