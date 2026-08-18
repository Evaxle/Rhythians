import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [users, clips] = await Promise.all([prisma.user.count(), prisma.clip.count()]);
    return NextResponse.json({ ok: true, database: "connected", users, clips });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}