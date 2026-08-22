import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  await prisma.$executeRaw`
    INSERT INTO "TermsAcceptance" ("id", "userId", "version", "acceptedAt")
    VALUES (${crypto.randomUUID()}, ${user.id}, ${CURRENT_TERMS_VERSION}, NOW())
    ON CONFLICT ("userId") DO UPDATE SET "version" = EXCLUDED."version", "acceptedAt" = EXCLUDED."acceptedAt"
  `;

  return NextResponse.json({ accepted: true, version: CURRENT_TERMS_VERSION });
}
