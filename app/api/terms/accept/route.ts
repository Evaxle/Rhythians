import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const TERMS_VERSION = "2026-08-22";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    },
  });

  return NextResponse.json({ accepted: true, version: TERMS_VERSION });
}
